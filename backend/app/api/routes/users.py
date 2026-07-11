from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List
import os, uuid, aiofiles
import cloudinary
import cloudinary.uploader

from app.db.database import get_db
from app.db.models import User
from app.schemas.user import UserOut, UserUpdate
from app.api.deps import get_current_user
from app.core.config import settings

router = APIRouter()

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)



@router.get("/search", response_model=List[UserOut])
async def search_users(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User).where(
            or_(
                User.display_name.ilike(f"%{q}%"),
                User.username.ilike(f"%{q}%"),
                User.phone.ilike(f"%{q}%"),
            ),
            User.id != current_user.id,
        ).limit(20)
    )
    return result.scalars().all()


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
async def update_profile(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.username is not None:
        # Check uniqueness
        result = await db.execute(
            select(User).where(User.username == body.username, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = body.username
    if body.bio is not None:
        current_user.bio = body.bio
    await db.commit()
    return current_user



    

@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/gif"]:
        raise HTTPException(status_code=400, detail="Invalid image format")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")

    result = cloudinary.uploader.upload(
        content,
        folder="avatars",
        public_id=str(uuid.uuid4()),
        resource_type="image",
    )

    current_user.avatar_url = result["secure_url"]
    await db.commit()
    return current_user

@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
