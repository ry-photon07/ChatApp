from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


class RegisterComplete(BaseModel):
    phone: str
    otp: str
    display_name: str
    username: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


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


TokenResponse.model_rebuild()
