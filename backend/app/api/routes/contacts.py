from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List

from app.db.database import get_db
from app.db.models import User, Contact
from app.schemas.user import ContactOut, ContactCreate, UserOut
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=List[ContactOut])
async def get_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Contact).where(Contact.owner_id == current_user.id)
    )
    contacts = result.scalars().all()
    out = []
    for c in contacts:
        user_res = await db.execute(select(User).where(User.id == c.contact_id))
        contact_user = user_res.scalar_one_or_none()
        if contact_user:
            out.append(ContactOut(
                id=c.id,
                contact_id=c.contact_id,
                nickname=c.nickname,
                created_at=c.created_at,
                user=UserOut.model_validate(contact_user),
            ))
    return out


@router.post("", response_model=ContactOut)
async def add_contact(
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find target user
    query = select(User)
    if body.phone:
        query = query.where(User.phone == body.phone.strip())
    elif body.username:
        query = query.where(User.username == body.username.strip())
    else:
        raise HTTPException(status_code=400, detail="Phone or username required")

    result = await db.execute(query)
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # Check duplicate
    existing = await db.execute(
        select(Contact).where(
            Contact.owner_id == current_user.id,
            Contact.contact_id == target.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Contact already added")

    contact = Contact(
        owner_id=current_user.id,
        contact_id=target.id,
        nickname=body.nickname,
    )
    db.add(contact)
    await db.commit()

    return ContactOut(
        id=contact.id,
        contact_id=contact.contact_id,
        nickname=contact.nickname,
        created_at=contact.created_at,
        user=UserOut.model_validate(target),
    )


@router.delete("/{contact_id}")
async def remove_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.owner_id == current_user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
    return {"message": "Contact removed"}
