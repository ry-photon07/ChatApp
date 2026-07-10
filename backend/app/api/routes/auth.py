from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import re

from app.db.database import get_db
from app.db.models import User, Session
from app.core.security import create_access_token
from app.core.config import settings
from app.schemas.auth import OTPRequest, OTPVerify, RegisterComplete, TokenResponse
from app.schemas.user import UserOut
from app.api.deps import get_current_user

router = APIRouter()

# In-memory OTP store (in production, use Redis)
_pending_otps: dict = {}


@router.post("/request-otp")
async def request_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    """Request OTP for phone number. Always returns mock OTP 123456."""
    phone = body.phone.strip()
    if not re.match(r"^\+?[\d\s\-()]{7,20}$", phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    # Check if user already exists
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    _pending_otps[phone] = settings.MOCK_OTP

    return {
        "message": f"OTP sent to {phone}",
        "hint": f"Use OTP: {settings.MOCK_OTP} (development mode)",
        "is_new_user": user is None,
    }


@router.post("/verify-otp")
async def verify_otp(body: OTPVerify, db: AsyncSession = Depends(get_db)):
    """Verify OTP and return token if user exists, or indicate registration needed."""
    phone = body.phone.strip()

    stored_otp = _pending_otps.get(phone)
    if not stored_otp or stored_otp != body.otp:
        # Accept the mock OTP directly too
        if body.otp != settings.MOCK_OTP:
            raise HTTPException(status_code=400, detail="Invalid OTP")

    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    if not user:
        return {"requires_registration": True, "phone": phone}

    # Create session
    token = create_access_token({"sub": user.id})
    session = Session(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    return {
        "requires_registration": False,
        "access_token": token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
    }


@router.post("/register", response_model=dict)
async def register(body: RegisterComplete, db: AsyncSession = Depends(get_db)):
    """Complete registration after OTP verification."""
    phone = body.phone.strip()

    if body.otp != settings.MOCK_OTP:
        stored_otp = _pending_otps.get(phone)
        if not stored_otp or stored_otp != body.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")

    # Check if phone already registered
    result = await db.execute(select(User).where(User.phone == phone))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Phone already registered")

    # Check username uniqueness
    if body.username:
        result = await db.execute(select(User).where(User.username == body.username))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        phone=phone,
        display_name=body.display_name,
        username=body.username,
        last_seen=datetime.utcnow(),
    )
    db.add(user)
    await db.flush()

    token = create_access_token({"sub": user.id})
    session = Session(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=settings.ACCESS_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    # Clean OTP
    _pending_otps.pop(phone, None)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user).model_dump(),
    }


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.db.models import Session as SessionModel
    from fastapi.security import HTTPBearer
    # Mark user offline
    current_user.is_online = False
    current_user.last_seen = datetime.utcnow()
    await db.commit()
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
