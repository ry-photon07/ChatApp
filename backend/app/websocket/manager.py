from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Set, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import asyncio
from datetime import datetime

from app.core.security import verify_token
from app.db.database import AsyncSessionLocal
from app.db.models import User, ConversationMember

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> user_id mapping
        self._ws_to_user: Dict[WebSocket, str] = {}
        self._typing_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self._ws_to_user[websocket] = user_id

        # Mark user online
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.is_online = True
                user.last_seen = datetime.utcnow()
                await db.commit()

        # Broadcast presence to contacts
        await self._broadcast_presence(user_id, True)

    def disconnect(self, websocket: WebSocket):
        user_id = self._ws_to_user.pop(websocket, None)
        if user_id and user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Schedule offline update
                asyncio.create_task(self._mark_offline(user_id))

    async def _mark_offline(self, user_id: str):
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                await db.commit()
        await self._broadcast_presence(user_id, False)

    async def _broadcast_presence(self, user_id: str, is_online: bool):
        """Broadcast presence update to all users who share conversations."""
        async with AsyncSessionLocal() as db:
            # Get all conversation members who share convos with this user
            result = await db.execute(
                select(ConversationMember.conversation_id).where(
                    ConversationMember.user_id == user_id
                )
            )
            conv_ids = [r[0] for r in result.all()]

            if not conv_ids:
                return

            result = await db.execute(
                select(ConversationMember.user_id).where(
                    ConversationMember.conversation_id.in_(conv_ids),
                    ConversationMember.user_id != user_id,
                )
            )
            user_ids = set(r[0] for r in result.all())

            payload = {
                "type": "presence",
                "data": {
                    "user_id": user_id,
                    "is_online": is_online,
                    "last_seen": datetime.utcnow().isoformat(),
                }
            }

            for uid in user_ids:
                await self.send_to_user(uid, payload)

    async def send_to_user(self, user_id: str, data: dict):
        """Send a message to all WebSocket connections for a user."""
        if user_id in self.active_connections:
            dead_ws = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead_ws.add(ws)
            for ws in dead_ws:
                self.disconnect(ws)

    async def broadcast_to_conversation(self, conv_id: str, data: dict, db: AsyncSession):
        """Broadcast a message to all members of a conversation."""
        result = await db.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conv_id
            )
        )
        user_ids = [r[0] for r in result.all()]
        for uid in user_ids:
            await self.send_to_user(uid, data)

    async def handle_typing(self, conv_id: str, user_id: str, is_typing: bool, db: AsyncSession):
        """Broadcast typing indicator to conversation members."""
        result = await db.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conv_id,
                ConversationMember.user_id != user_id,
            )
        )
        user_ids = [r[0] for r in result.all()]

        payload = {
            "type": "typing",
            "data": {
                "conversation_id": conv_id,
                "user_id": user_id,
                "is_typing": is_typing,
            }
        }

        for uid in user_ids:
            await self.send_to_user(uid, payload)

        # Auto-cancel typing after 5 seconds
        if is_typing:
            task_key = f"{conv_id}:{user_id}"
            if task_key in self._typing_tasks:
                self._typing_tasks[task_key].cancel()

            async def cancel_typing():
                await asyncio.sleep(5)
                for uid in user_ids:
                    await self.send_to_user(uid, {
                        "type": "typing",
                        "data": {
                            "conversation_id": conv_id,
                            "user_id": user_id,
                            "is_typing": False,
                        }
                    })

            task = asyncio.create_task(cancel_typing())
            self._typing_tasks[task_key] = task


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")

                async with AsyncSessionLocal() as db:
                    if msg_type == "typing":
                        await manager.handle_typing(
                            msg.get("conversation_id"),
                            user_id,
                            msg.get("is_typing", False),
                            db,
                        )
                    elif msg_type == "read":
                        # Handle read receipt
                        conv_id = msg.get("conversation_id")
                        from app.db.models import MessageStatus as MS, Message
                        from sqlalchemy import update
                        
                        # Find status IDs for this conversation sent by others
                        status_ids_result = await db.execute(
                            select(MS.id)
                            .join(Message, Message.id == MS.message_id)
                            .where(
                                Message.conversation_id == conv_id,
                                Message.sender_id != user_id,
                                MS.user_id == user_id,
                                MS.status != "read"
                            )
                        )
                        status_ids = [r[0] for r in status_ids_result.all()]
                        
                        if status_ids:
                            await db.execute(
                                update(MS)
                                .where(MS.id.in_(status_ids))
                                .values(status="read", updated_at=datetime.utcnow())
                            )
                            await db.commit()

                        await manager.broadcast_to_conversation(
                            conv_id,
                            {
                                "type": "read_receipt",
                                "data": {
                                    "conversation_id": conv_id,
                                    "user_id": user_id,
                                    "read_at": datetime.utcnow().isoformat(),
                                }
                            },
                            db,
                        )
                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"WS error: {e}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
