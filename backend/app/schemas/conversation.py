from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserOut


class MemberOut(BaseModel):
    id: str
    user_id: str
    role: str
    joined_at: datetime
    last_read_at: Optional[datetime]
    is_muted: bool
    is_pinned: bool
    user: UserOut

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    id: str
    file_name: str
    file_size: int
    mime_type: str
    url: str

    class Config:
        from_attributes = True


class ReactionOut(BaseModel):
    id: str
    user_id: str
    emoji: str
    created_at: datetime
    user: UserOut

    class Config:
        from_attributes = True


class MessageStatusOut(BaseModel):
    user_id: str
    status: str
    updated_at: datetime

    class Config:
        from_attributes = True


class ReplyPreview(BaseModel):
    id: str
    content: Optional[str]
    sender_display_name: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: Optional[str]
    type: str
    reply_to_id: Optional[str]
    reply_preview: Optional[ReplyPreview]
    is_deleted: bool
    disappears_at: Optional[datetime]
    created_at: datetime
    edited_at: Optional[datetime]
    sender: UserOut
    statuses: List[MessageStatusOut]
    reactions: List[ReactionOut]
    attachments: List[AttachmentOut]

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: Optional[str] = None
    type: str = "text"
    reply_to_id: Optional[str] = None


class ConversationOut(BaseModel):
    id: str
    type: str
    name: Optional[str]
    avatar_url: Optional[str]
    description: Optional[str]
    created_by: str
    created_at: datetime
    last_message_at: Optional[datetime]
    disappearing_timer: Optional[int]
    is_archived: bool
    members: List[MemberOut]
    last_message: Optional[MessageOut]
    unread_count: int

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    type: str = "direct"
    member_ids: List[str]
    name: Optional[str] = None
    description: Optional[str] = None


class ConversationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    disappearing_timer: Optional[int] = None


class AddMemberRequest(BaseModel):
    user_id: str


class ReactionCreate(BaseModel):
    emoji: str
