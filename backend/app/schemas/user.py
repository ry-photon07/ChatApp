from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserOut(BaseModel):
    id: str
    phone: str
    username: Optional[str]
    display_name: str
    avatar_url: Optional[str]
    bio: Optional[str]
    is_online: bool
    last_seen: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None


class UserSearch(BaseModel):
    query: str


class ContactOut(BaseModel):
    id: str
    contact_id: str
    nickname: Optional[str]
    created_at: datetime
    user: UserOut

    class Config:
        from_attributes = True


class ContactCreate(BaseModel):
    phone: Optional[str] = None
    username: Optional[str] = None
    nickname: Optional[str] = None
