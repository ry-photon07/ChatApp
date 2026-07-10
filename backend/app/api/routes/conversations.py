from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import (
    User, Conversation, ConversationMember, Message,
    MessageStatus, MessageReaction, Attachment
)
from app.schemas.conversation import (
    ConversationOut, ConversationCreate, ConversationUpdate,
    AddMemberRequest, MemberOut, MessageOut, ReactionCreate
)
from app.schemas.user import UserOut
from app.api.deps import get_current_user
from app.websocket.manager import manager

router = APIRouter()


async def build_conversation_out(conv: Conversation, current_user_id: str, db: AsyncSession) -> ConversationOut:
    """Build a rich ConversationOut with last_message and unread_count."""
    # Get members with user data
    member_results = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv.id
        ).options(joinedload(ConversationMember.user))
    )
    members = member_results.scalars().all()

    members_out = []
    current_member = None
    for m in members:
        members_out.append(MemberOut(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            last_read_at=m.last_read_at,
            is_muted=m.is_muted,
            is_pinned=m.is_pinned,
            user=UserOut.model_validate(m.user),
        ))
        if m.user_id == current_user_id:
            current_member = m

    # Get last message
    last_msg_result = await db.execute(
        select(Message).where(
            Message.conversation_id == conv.id,
            Message.is_deleted == False,
        ).options(
            joinedload(Message.sender),
            joinedload(Message.statuses),
            joinedload(Message.reactions).joinedload(MessageReaction.user),
            joinedload(Message.attachments),
        ).order_by(desc(Message.created_at)).limit(1)
    )
    last_msg = last_msg_result.unique().scalar_one_or_none()

    last_message_out = None
    if last_msg:
        last_message_out = await build_message_out(last_msg, db)

    # Unread count
    unread_count = 0
    if current_member and current_member.last_read_at:
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conv.id,
                Message.sender_id != current_user_id,
                Message.created_at > current_member.last_read_at,
                Message.is_deleted == False,
            )
        )
        unread_count = unread_result.scalar() or 0
    elif current_member:
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conv.id,
                Message.sender_id != current_user_id,
                Message.is_deleted == False,
            )
        )
        unread_count = unread_result.scalar() or 0

    return ConversationOut(
        id=conv.id,
        type=conv.type,
        name=conv.name,
        avatar_url=conv.avatar_url,
        description=conv.description,
        created_by=conv.created_by,
        created_at=conv.created_at,
        last_message_at=conv.last_message_at,
        disappearing_timer=conv.disappearing_timer,
        is_archived=conv.is_archived,
        members=members_out,
        last_message=last_message_out,
        unread_count=unread_count,
    )


async def build_message_out(msg: Message, db: AsyncSession) -> MessageOut:
    reply_preview = None
    if msg.reply_to_id:
        reply_result = await db.execute(
            select(Message).where(Message.id == msg.reply_to_id)
            .options(joinedload(Message.sender))
        )
        reply_msg = reply_result.scalar_one_or_none()
        if reply_msg:
            from app.schemas.conversation import ReplyPreview
            reply_preview = ReplyPreview(
                id=reply_msg.id,
                content=reply_msg.content,
                sender_display_name=reply_msg.sender.display_name,
            )

    from app.schemas.conversation import (
        MessageStatusOut, ReactionOut, AttachmentOut, ReplyPreview as RP
    )
    statuses = [
        MessageStatusOut(user_id=s.user_id, status=s.status, updated_at=s.updated_at)
        for s in msg.statuses
    ]
    reactions_out = []
    for r in msg.reactions:
        if r.user:
            reactions_out.append(ReactionOut(
                id=r.id,
                user_id=r.user_id,
                emoji=r.emoji,
                created_at=r.created_at,
                user=UserOut.model_validate(r.user),
            ))

    attachments_out = [
        AttachmentOut(
            id=a.id,
            file_name=a.file_name,
            file_size=a.file_size,
            mime_type=a.mime_type,
            url=a.url,
        )
        for a in msg.attachments
    ]

    return MessageOut(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        content=msg.content,
        type=msg.type,
        reply_to_id=msg.reply_to_id,
        reply_preview=reply_preview,
        is_deleted=msg.is_deleted,
        disappears_at=msg.disappears_at,
        created_at=msg.created_at,
        edited_at=msg.edited_at,
        sender=UserOut.model_validate(msg.sender),
        statuses=statuses,
        reactions=reactions_out,
        attachments=attachments_out,
    )


@router.get("", response_model=List[ConversationOut])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    archived: bool = False,
):
    """List all conversations for the current user, sorted by last activity."""
    member_result = await db.execute(
        select(ConversationMember.conversation_id).where(
            ConversationMember.user_id == current_user.id
        )
    )
    conv_ids = [r[0] for r in member_result.all()]

    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id.in_(conv_ids),
            Conversation.is_archived == archived,
        ).order_by(desc(Conversation.last_message_at))
    )
    conversations = conv_result.scalars().all()

    results = []
    for conv in conversations:
        results.append(await build_conversation_out(conv, current_user.id, db))
    return results


@router.post("", response_model=ConversationOut)
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # For direct: check if conversation already exists
    all_member_ids = list(set(body.member_ids + [current_user.id]))

    if body.type == "direct":
        if len(all_member_ids) != 2:
            raise HTTPException(status_code=400, detail="Direct conversation requires exactly 2 members")

        other_id = [m for m in all_member_ids if m != current_user.id][0]
        # Find existing direct conversation between these two
        result = await db.execute(
            select(Conversation).where(
                Conversation.type == "direct",
            )
        )
        existing_convs = result.scalars().all()
        for ec in existing_convs:
            member_res = await db.execute(
                select(ConversationMember.user_id).where(
                    ConversationMember.conversation_id == ec.id
                )
            )
            ec_members = [r[0] for r in member_res.all()]
            if set(ec_members) == set(all_member_ids):
                return await build_conversation_out(ec, current_user.id, db)

    if body.type == "group" and not body.name:
        raise HTTPException(status_code=400, detail="Group name required")

    conv = Conversation(
        type=body.type,
        name=body.name,
        description=body.description,
        created_by=current_user.id,
        last_message_at=datetime.utcnow(),
    )
    db.add(conv)
    await db.flush()

    for uid in all_member_ids:
        role = "admin" if uid == current_user.id else "member"
        member = ConversationMember(
            conversation_id=conv.id,
            user_id=uid,
            role=role,
        )
        db.add(member)

    await db.commit()

    # System message for group creation
    if body.type == "group":
        system_msg = Message(
            conversation_id=conv.id,
            sender_id=current_user.id,
            content=f"{current_user.display_name} created the group",
            type="system",
        )
        db.add(system_msg)
        await db.commit()

    return await build_conversation_out(conv, current_user.id, db)


@router.get("/{conv_id}", response_model=ConversationOut)
async def get_conversation(
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify membership
    member_check = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    conv_result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return await build_conversation_out(conv, current_user.id, db)


@router.get("/{conv_id}/messages", response_model=List[MessageOut])
async def get_messages(
    conv_id: str,
    before: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify membership
    member_check = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    member = member_check.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member")

    query = select(Message).where(
        Message.conversation_id == conv_id,
    ).options(
        joinedload(Message.sender),
        joinedload(Message.statuses),
        joinedload(Message.reactions).joinedload(MessageReaction.user),
        joinedload(Message.attachments),
    ).order_by(desc(Message.created_at)).limit(limit)

    if before:
        before_result = await db.execute(select(Message).where(Message.id == before))
        before_msg = before_result.scalar_one_or_none()
        if before_msg:
            query = query.where(Message.created_at < before_msg.created_at)

    result = await db.execute(query)
    messages = result.scalars().unique().all()

    # Update last_read_at
    member.last_read_at = datetime.utcnow()
    await db.commit()

    # Mark messages as read
    for msg in messages:
        if msg.sender_id != current_user.id:
            for status in msg.statuses:
                if status.user_id == current_user.id and status.status != "read":
                    status.status = "read"
                    # Broadcast read receipt
                    await manager.broadcast_to_conversation(
                        conv_id,
                        {
                            "type": "message_status",
                            "data": {
                                "message_id": msg.id,
                                "user_id": current_user.id,
                                "status": "read",
                                "conversation_id": conv_id,
                            }
                        },
                        db,
                    )
    await db.commit()

    return [await build_message_out(m, db) for m in reversed(messages)]


class MessageCreateBody(BaseModel):
    content: Optional[str] = None
    type: str = "text"
    reply_to_id: Optional[str] = None


@router.post("/{conv_id}/messages", response_model=MessageOut)
async def send_message(
    conv_id: str,
    body: MessageCreateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_check = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    # Get conversation for disappearing timer
    conv_result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    disappears_at = None
    if conv.disappearing_timer:
        from datetime import timedelta
        disappears_at = datetime.utcnow() + timedelta(seconds=conv.disappearing_timer)

    msg = Message(
        conversation_id=conv_id,
        sender_id=current_user.id,
        content=body.content,
        type=body.type or "text",
        reply_to_id=body.reply_to_id,
        disappears_at=disappears_at,
    )
    db.add(msg)
    await db.flush()

    # Update conversation last_message_at
    conv.last_message_at = datetime.utcnow()

    # Create delivery statuses for all members
    all_members_result = await db.execute(
        select(ConversationMember).where(ConversationMember.conversation_id == conv_id)
    )
    all_members = all_members_result.scalars().all()

    for m in all_members:
        if m.user_id != current_user.id:
            status = MessageStatus(
                message_id=msg.id,
                user_id=m.user_id,
                status="delivered",
            )
            db.add(status)

    # Sender's own status
    sender_status = MessageStatus(
        message_id=msg.id,
        user_id=current_user.id,
        status="sent",
    )
    db.add(sender_status)
    await db.commit()

    # Reload with relationships
    msg_result = await db.execute(
        select(Message).where(Message.id == msg.id).options(
            joinedload(Message.sender),
            joinedload(Message.statuses),
            joinedload(Message.reactions).joinedload(MessageReaction.user),
            joinedload(Message.attachments),
        )
    )
    msg = msg_result.scalar_one()

    msg_out = await build_message_out(msg, db)

    # Broadcast to all conversation members
    await manager.broadcast_to_conversation(
        conv_id,
        {"type": "new_message", "data": msg_out.model_dump(mode="json")},
        db,
    )

    return msg_out





@router.put("/{conv_id}", response_model=ConversationOut)
async def update_conversation(
    conv_id: str,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_check = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.role == "admin",
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Admin access required")

    conv_result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.name is not None:
        conv.name = body.name
    if body.description is not None:
        conv.description = body.description
    if body.disappearing_timer is not None:
        conv.disappearing_timer = body.disappearing_timer

    await db.commit()
    return await build_conversation_out(conv, current_user.id, db)


@router.post("/{conv_id}/members")
async def add_member(
    conv_id: str,
    body: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check admin
    member_check = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.role == "admin",
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Admin access required")

    # Check target user exists
    user_result = await db.execute(select(User).where(User.id == body.user_id))
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check not already member
    existing = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already a member")

    new_member = ConversationMember(
        conversation_id=conv_id,
        user_id=body.user_id,
        role="member",
    )
    db.add(new_member)

    # System message
    conv_result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = conv_result.scalar_one_or_none()
    if conv:
        system_msg = Message(
            conversation_id=conv_id,
            sender_id=current_user.id,
            content=f"{current_user.display_name} added {target_user.display_name}",
            type="system",
        )
        db.add(system_msg)
        conv.last_message_at = datetime.utcnow()

    await db.commit()
    return {"message": "Member added"}


@router.delete("/{conv_id}/members/{user_id}")
async def remove_member(
    conv_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Admin can remove anyone; members can leave (remove themselves)
    if user_id != current_user.id:
        admin_check = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conv_id,
                ConversationMember.user_id == current_user.id,
                ConversationMember.role == "admin",
            )
        )
        if not admin_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Admin access required")

    target_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == user_id,
        )
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    user_result = await db.execute(select(User).where(User.id == user_id))
    removed_user = user_result.scalar_one_or_none()

    await db.delete(target)

    # System message
    conv_result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = conv_result.scalar_one_or_none()
    if conv and removed_user:
        action = "left the group" if user_id == current_user.id else f"was removed by {current_user.display_name}"
        system_msg = Message(
            conversation_id=conv_id,
            sender_id=current_user.id,
            content=f"{removed_user.display_name} {action}",
            type="system",
        )
        db.add(system_msg)
        conv.last_message_at = datetime.utcnow()

    await db.commit()
    return {"message": "Member removed"}


@router.post("/{conv_id}/read")
async def mark_read(
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if member:
        member.last_read_at = datetime.utcnow()
        await db.commit()
    return {"message": "Marked as read"}


@router.patch("/{conv_id}/mute")
async def toggle_mute(
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member")
    member.is_muted = not member.is_muted
    await db.commit()
    return {"is_muted": member.is_muted}


@router.patch("/{conv_id}/pin")
async def toggle_pin(
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == current_user.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member")
    member.is_pinned = not member.is_pinned
    await db.commit()
    return {"is_pinned": member.is_pinned}
