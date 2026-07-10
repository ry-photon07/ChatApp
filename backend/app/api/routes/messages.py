from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from datetime import datetime
import os, uuid, aiofiles

from app.db.database import get_db
from app.db.models import Message, MessageStatus, MessageReaction, Attachment, ConversationMember, Conversation
from app.schemas.conversation import ReactionCreate, MessageOut, ReactionOut
from app.schemas.user import UserOut
from app.api.deps import get_current_user
from app.db.models import User
from app.websocket.manager import manager
from app.core.config import settings

router = APIRouter()


@router.post("/{message_id}/reactions", response_model=ReactionOut)
async def add_reaction(
    message_id: str,
    body: ReactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    msg = msg_result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Remove existing reaction with same emoji by same user
    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == body.emoji,
        )
    )
    existing_r = existing.scalar_one_or_none()
    if existing_r:
        await db.delete(existing_r)
        await db.commit()
        return {"message": "Reaction removed"}

    reaction = MessageReaction(
        message_id=message_id,
        user_id=current_user.id,
        emoji=body.emoji,
    )
    db.add(reaction)
    await db.commit()

    reaction_out = ReactionOut(
        id=reaction.id,
        user_id=reaction.user_id,
        emoji=reaction.emoji,
        created_at=reaction.created_at,
        user=UserOut.model_validate(current_user),
    )

    # Broadcast reaction
    await manager.broadcast_to_conversation(
        msg.conversation_id,
        {
            "type": "reaction",
            "data": {
                "message_id": message_id,
                "conversation_id": msg.conversation_id,
                **reaction_out.model_dump(mode="json"),
            }
        },
        db,
    )

    return reaction_out


@router.delete("/{message_id}/reactions/{emoji}")
async def remove_reaction(
    message_id: str,
    emoji: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    reaction = result.scalar_one_or_none()
    if not reaction:
        raise HTTPException(status_code=404, detail="Reaction not found")
    await db.delete(reaction)
    await db.commit()
    return {"message": "Reaction removed"}


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.sender_id == current_user.id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")

    msg.is_deleted = True
    msg.content = "This message was deleted"
    await db.commit()

    await manager.broadcast_to_conversation(
        msg.conversation_id,
        {"type": "message_deleted", "data": {"message_id": message_id, "conversation_id": msg.conversation_id}},
        db,
    )

    return {"message": "Message deleted"}


@router.post("/{message_id}/attachments")
async def upload_attachment(
    message_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg_result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.sender_id == current_user.id,
        )
    )
    msg = msg_result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")

    ext = file.filename.split(".")[-1] if file.filename else "bin"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, "attachments", filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    attachment = Attachment(
        message_id=message_id,
        file_name=file.filename or filename,
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        url=f"/uploads/attachments/{filename}",
    )
    db.add(attachment)
    await db.commit()

    return {
        "id": attachment.id,
        "file_name": attachment.file_name,
        "file_size": attachment.file_size,
        "mime_type": attachment.mime_type,
        "url": attachment.url,
    }
