"""
Seed script for Signal Clone.
Run: python seed.py
Creates 8 users, 4 direct conversations, 2 group conversations
with realistic message histories spanning the last 7 days.
"""

import asyncio
import uuid
from datetime import datetime, timedelta
import random
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.db.database import Base
from app.db.models import (
    User, Session, Contact, Conversation, ConversationMember,
    Message, MessageStatus, MessageReaction
)
from app.core.security import create_access_token
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import hashlib
import base64

def encrypt_aes_cryptojs(text: str, passphrase: str) -> str:
    if not text:
        return ""
    salt = os.urandom(8)
    data = passphrase.encode("utf-8")
    dx = b""
    hash_buf = b""
    while len(dx) < 48:
        hash_buf = hashlib.md5(hash_buf + data + salt).digest()
        dx += hash_buf
    key = dx[:32]
    iv = dx[32:48]
    encoded = text.encode("utf-8")
    pad_len = 16 - (len(encoded) % 16)
    padded_text = encoded + bytes([pad_len] * pad_len)
    encryptor = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend()).encryptor()
    ciphertext = encryptor.update(padded_text) + encryptor.finalize()
    payload = b"Salted__" + salt + ciphertext
    return base64.b64encode(payload).decode("utf-8")
from app.core.config import settings

DATABASE_URL = "sqlite+aiosqlite:///./signal_clone.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# Realistic users
USERS = [
    {"phone": "+1-555-0101", "username": "alice_g", "display_name": "Alice Greene", "bio": "Software Engineer 🚀 | Coffee lover ☕"},
    {"phone": "+1-555-0102", "username": "bob_m", "display_name": "Bob Martinez", "bio": "Product Manager | Weekend hiker 🏔️"},
    {"phone": "+1-555-0103", "username": "charlie_k", "display_name": "Charlie Kim", "bio": "Designer | Making things pretty ✨"},
    {"phone": "+1-555-0104", "username": "diana_p", "display_name": "Diana Patel", "bio": "Data Scientist | Python enthusiast 🐍"},
    {"phone": "+1-555-0105", "username": "eve_j", "display_name": "Eve Johnson", "bio": "Frontend Dev | React & Next.js 💻"},
    {"phone": "+1-555-0106", "username": "frank_l", "display_name": "Frank Lee", "bio": "DevOps Engineer | Cloud ☁️"},
    {"phone": "+1-555-0107", "username": "grace_w", "display_name": "Grace Wilson", "bio": "UX Researcher | Curious about people 🔍"},
    {"phone": "+1-555-0108", "username": "henry_b", "display_name": "Henry Brown", "bio": "Security Engineer | Ethical hacker 🔐"},
]

# Conversation message templates
ALICE_BOB_MESSAGES = [
    ("alice", "Hey! Are you free for a call later today?"),
    ("bob", "Sure! What time works for you?"),
    ("alice", "How about 3pm?"),
    ("bob", "3pm works great. Talk then! 👍"),
    ("alice", "Just sent you the design files for the new feature"),
    ("bob", "Got them, thanks! Will review before our call"),
    ("alice", "Let me know if you have questions"),
    ("bob", "Will do. The mockups look really clean btw"),
    ("alice", "Thanks! Charlie helped a lot with the visual style"),
    ("bob", "I can tell 😄 Great collaboration"),
    ("alice", "So the call is in 30 min, still good?"),
    ("bob", "Yes! Just finishing up a PR review"),
    ("alice", "No rush, I'll set up the zoom link"),
    ("bob", "Perfect, drop it in here when ready"),
    ("alice", "https://zoom.us/j/mock-link-12345"),
    ("bob", "Thanks! Joining now"),
    ("alice", "Great call! Really productive"),
    ("bob", "Agreed. I'll write up the action items"),
    ("alice", "Can you share them with Diana too?"),
    ("bob", "Of course, will loop her in 👌"),
]

CHARLIE_DIANA_MESSAGES = [
    ("diana", "Charlie, can you help me visualize this data?"),
    ("charlie", "Sure! What kind of chart are you thinking?"),
    ("diana", "Maybe a heatmap? Or something interactive?"),
    ("charlie", "Heatmap sounds great for correlation data. Let me sketch something"),
    ("diana", "Here's the dataset structure: columns are features, rows are samples"),
    ("charlie", "Perfect. I'll use D3.js for the interactive version"),
    ("diana", "That would be amazing! Any ETA?"),
    ("charlie", "Should have a prototype by tomorrow EOD"),
    ("diana", "You're the best! ❤️"),
    ("charlie", "Haha, just doing my job 😄"),
    ("diana", "Quick update - I added 3 more feature columns"),
    ("charlie", "No problem, the design scales well"),
    ("diana", "Sent you the updated CSV"),
    ("charlie", "Got it! The visualization is coming together nicely"),
    ("diana", "Can't wait to see it!"),
    ("charlie", "Preview: [screenshot attached] 🎨"),
    ("diana", "Oh wow, that looks incredible!!"),
    ("charlie", "Thanks! Added some color interpolation for better readability"),
    ("diana", "This is exactly what I needed for the presentation"),
    ("charlie", "Happy to help. Let me know if you want any tweaks"),
]

EVE_FRANK_MESSAGES = [
    ("frank", "Eve, the deployment just failed 😱"),
    ("eve", "What?! Which service?"),
    ("frank", "The API gateway. Getting 502 errors"),
    ("eve", "Can you paste the error logs?"),
    ("frank", "ERROR: Connection refused to upstream service on port 8080"),
    ("eve", "Looks like the backend container didn't start correctly"),
    ("frank", "How do I check that?"),
    ("eve", "Run: docker ps -a | grep backend"),
    ("frank", "Status shows: Exited (1) 2 minutes ago"),
    ("eve", "Check the logs: docker logs <container_id>"),
    ("frank", "ModuleNotFoundError: No module named 'app.core'"),
    ("eve", "Ahhh, you need to rebuild the image! Did you pull the latest changes?"),
    ("frank", "...No 😅"),
    ("eve", "Run: git pull && docker-compose up --build -d"),
    ("frank", "Building... this is taking a while"),
    ("eve", "That's normal for a full rebuild, maybe 3-5 min"),
    ("frank", "IT'S UP! 🎉🎉🎉"),
    ("eve", "Amazing! Next time check git status first 😄"),
    ("frank", "Lesson learned. You're a lifesaver Eve!"),
    ("eve", "Anytime! Set up proper health checks and alerts for next time"),
]

ALICE_HENRY_MESSAGES = [
    ("henry", "Alice, quick security question about the new auth flow"),
    ("alice", "Go ahead!"),
    ("henry", "Are you storing session tokens in localStorage?"),
    ("alice", "HttpOnly cookies actually. I learned from last time 😅"),
    ("henry", "Smart! Much safer against XSS"),
    ("alice", "Yeah, we also added CSRF protection"),
    ("henry", "Perfect. What about the token expiry?"),
    ("alice", "30 days, but we invalidate on logout"),
    ("henry", "Good. One more thing - rate limiting on the auth endpoints?"),
    ("alice", "Not yet, but it's on the backlog"),
    ("henry", "Make it a priority. Brute force attacks are real"),
    ("alice", "Adding it to next sprint. Thanks for the review!"),
    ("henry", "Of course! Security is everyone's responsibility 🔐"),
    ("alice", "Agreed. Hey, can you do a full security audit next week?"),
    ("henry", "Sure, block me 2 hours on Thursday"),
]

# Group conversation messages
SIGNAL_DEV_TEAM_MESSAGES = [
    ("alice", "Good morning team! 🌅"),
    ("bob", "Morning! Ready for the sprint planning?"),
    ("charlie", "On my way to the office, be there in 10"),
    ("diana", "I'm dialed in remotely today"),
    ("alice", "Great! Let's start with yesterday's standups"),
    ("bob", "I finished the conversation list component"),
    ("charlie", "Working on the message bubble designs, almost done"),
    ("diana", "Set up the WebSocket connection manager ✅"),
    ("alice", "Awesome progress everyone!"),
    ("eve", "Just joined! What did I miss?"),
    ("bob", "Standups, we're all on track"),
    ("eve", "Great! I'll tackle the typing indicator today"),
    ("frank", "I'll handle the Docker setup and CI/CD"),
    ("alice", "Perfect distribution. Any blockers?"),
    ("charlie", "I need design feedback on the dark mode palette"),
    ("bob", "Let's do a quick design review after standup"),
    ("diana", "Shared my screen, can everyone see?"),
    ("alice", "Yes! Looks great Diana"),
    ("charlie", "Love the dark theme! Very Signal-like 😍"),
    ("eve", "The typing indicator animation is smooth!"),
    ("frank", "Docker containers are all green 🟢"),
    ("alice", "We're shipping this thing! Amazing team work 🚀"),
    ("bob", "Huge shoutout to everyone 🎉"),
    ("diana", "Can't believe how far we've come in a week"),
    ("charlie", "Group hug through the screen! 🤗"),
]

WEEKEND_HIKERS_MESSAGES = [
    ("bob", "Hey hikers! Planning this weekend's trail"),
    ("grace", "I'm so in! Where are we thinking?"),
    ("henry", "How about the Blue Ridge trail? Beautiful views"),
    ("bob", "Ooh good one! About 8 miles round trip"),
    ("grace", "That's doable. What time Saturday?"),
    ("henry", "7am start? Beat the heat"),
    ("bob", "Perfect, meeting at the trailhead parking lot"),
    ("grace", "Should we bring extra water? Last time I ran out 😅"),
    ("henry", "Always! At least 3L per person for 8 miles"),
    ("bob", "I'll pack some trail mix and energy bars too"),
    ("grace", "I'll bring the first aid kit"),
    ("henry", "Great, we're well prepared!"),
    ("bob", "Weather looks perfect - 72°F and sunny ☀️"),
    ("grace", "Can't wait! It's been too long since our last hike"),
    ("henry", "Same! Really needed this after the crazy work week"),
    ("bob", "See you both bright and early Saturday! 🏔️"),
    ("grace", "Can't wait! Getting my boots ready 🥾"),
    ("henry", "Just checked, trail is open and no crowds expected"),
    ("bob", "Saturday is going to be amazing"),
    ("grace", "Photos of the summit are going in my highlights 📸"),
    ("henry", "Ha! Same. The view from the top is worth every step"),
]


def ts(days_ago: float, hour: int = 12, minute: int = 0) -> datetime:
    """Create a datetime relative to now."""
    base = datetime.utcnow() - timedelta(days=days_ago)
    return base.replace(hour=hour, minute=minute, second=random.randint(0, 59), microsecond=0)


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    print("✓ Tables created")

    async with AsyncSessionLocal() as db:
        # Create users
        user_map = {}
        for i, u_data in enumerate(USERS):
            u = User(
                id=str(uuid.uuid4()),
                phone=u_data["phone"],
                username=u_data["username"],
                display_name=u_data["display_name"],
                bio=u_data["bio"],
                is_online=random.choice([True, False, False]),
                last_seen=datetime.utcnow() - timedelta(minutes=random.randint(1, 1440)),
                created_at=datetime.utcnow() - timedelta(days=30),
            )
            db.add(u)
            user_map[u_data["username"].split("_")[0]] = u

        await db.flush()
        print(f"✓ Created {len(user_map)} users")

        # Create sessions (tokens for testing)
        for name, u in user_map.items():
            token = create_access_token({"sub": u.id})
            session = Session(
                user_id=u.id,
                token=token,
                expires_at=datetime.utcnow() + timedelta(days=30),
            )
            db.add(session)
            print(f"  Token for {u.display_name} ({u.phone}): {token[:40]}...")

        await db.flush()

        # Create contacts
        for name, u in user_map.items():
            others = [other for n, other in user_map.items() if n != name]
            for other in random.sample(others, min(4, len(others))):
                c = Contact(owner_id=u.id, contact_id=other.id)
                db.add(c)

        await db.flush()
        print("✓ Created contacts")

        async def create_direct_conv(user1_key: str, user2_key: str, messages_data, days_ago_start: float) -> Conversation:
            u1 = user_map[user1_key]
            u2 = user_map[user2_key]

            conv = Conversation(
                id=str(uuid.uuid4()),
                type="direct",
                created_by=u1.id,
                created_at=ts(days_ago_start + len(messages_data) / 24),
                last_message_at=ts(0, 10, 30),
            )
            db.add(conv)
            await db.flush()

            # Add members
            for u in [u1, u2]:
                m = ConversationMember(
                    conversation_id=conv.id,
                    user_id=u.id,
                    role="member",
                    joined_at=conv.created_at,
                    last_read_at=datetime.utcnow() - timedelta(minutes=random.randint(0, 30)),
                )
                db.add(m)

            await db.flush()

            # Add messages
            total = len(messages_data)
            for idx, (sender_key, content) in enumerate(messages_data):
                progress = idx / total
                msg_time = ts(days_ago_start * (1 - progress), random.randint(8, 22), random.randint(0, 59))
                sender = user_map[sender_key]
                msg = Message(
                    id=str(uuid.uuid4()),
                    conversation_id=conv.id,
                    sender_id=sender.id,
                    content=encrypt_aes_cryptojs(content, conv.id),
                    type="text",
                    created_at=msg_time,
                )
                db.add(msg)
                await db.flush()

                # Status for recipient
                recipient = u2 if sender.id == u1.id else u1
                status_val = "read" if progress < 0.9 else random.choice(["delivered", "read"])
                status = MessageStatus(
                    message_id=msg.id,
                    user_id=recipient.id,
                    status=status_val,
                    updated_at=msg_time + timedelta(seconds=random.randint(1, 60)),
                )
                db.add(status)
                # Sender status
                db.add(MessageStatus(
                    message_id=msg.id,
                    user_id=sender.id,
                    status="sent",
                    updated_at=msg_time,
                ))

                # Random reactions
                if random.random() < 0.1:
                    emoji = random.choice(["❤️", "😂", "👍", "🔥", "😮"])
                    reaction = MessageReaction(
                        message_id=msg.id,
                        user_id=recipient.id,
                        emoji=emoji,
                    )
                    db.add(reaction)

            conv.last_message_at = msg_time
            return conv

        # Direct conversations
        await create_direct_conv("alice", "bob", ALICE_BOB_MESSAGES, 3.0)
        await create_direct_conv("charlie", "diana", CHARLIE_DIANA_MESSAGES, 5.0)
        await create_direct_conv("eve", "frank", EVE_FRANK_MESSAGES, 1.0)
        await create_direct_conv("alice", "henry", ALICE_HENRY_MESSAGES, 2.0)

        print("✓ Created 4 direct conversations")

        # Group conversations
        async def create_group_conv(name: str, description: str, member_keys: list, messages_data, days_ago_start: float) -> Conversation:
            creator = user_map[member_keys[0]]
            conv = Conversation(
                id=str(uuid.uuid4()),
                type="group",
                name=name,
                description=description,
                created_by=creator.id,
                created_at=ts(days_ago_start + 1),
                last_message_at=ts(0, 14, 0),
            )
            db.add(conv)
            await db.flush()

            members = [user_map[k] for k in member_keys]
            for u in members:
                role = "admin" if u.id == creator.id else "member"
                m = ConversationMember(
                    conversation_id=conv.id,
                    user_id=u.id,
                    role=role,
                    joined_at=conv.created_at,
                    last_read_at=datetime.utcnow() - timedelta(minutes=random.randint(0, 120)),
                )
                db.add(m)
            await db.flush()

            # System message
            sys_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conv.id,
                sender_id=creator.id,
                content=f"{creator.display_name} created the group '{name}'",
                type="system",
                created_at=conv.created_at,
            )
            db.add(sys_msg)
            await db.flush()

            total = len(messages_data)
            for idx, (sender_key, content) in enumerate(messages_data):
                progress = idx / total
                msg_time = ts(days_ago_start * (1 - progress), random.randint(8, 22), random.randint(0, 59))
                sender = user_map[sender_key]
                msg = Message(
                    id=str(uuid.uuid4()),
                    conversation_id=conv.id,
                    sender_id=sender.id,
                    content=encrypt_aes_cryptojs(content, conv.id),
                    type="text",
                    created_at=msg_time,
                )
                db.add(msg)
                await db.flush()

                # Statuses for all other members
                for u in members:
                    if u.id != sender.id:
                        status_val = "read" if progress < 0.8 else random.choice(["delivered", "read"])
                        db.add(MessageStatus(
                            message_id=msg.id,
                            user_id=u.id,
                            status=status_val,
                            updated_at=msg_time + timedelta(seconds=random.randint(1, 300)),
                        ))
                db.add(MessageStatus(
                    message_id=msg.id,
                    user_id=sender.id,
                    status="sent",
                    updated_at=msg_time,
                ))

                # Group reactions more common
                if random.random() < 0.2:
                    reactor = random.choice([u for u in members if u.id != sender.id])
                    emoji = random.choice(["❤️", "😂", "👍", "🔥", "💯", "🎉"])
                    reaction = MessageReaction(
                        message_id=msg.id,
                        user_id=reactor.id,
                        emoji=emoji,
                    )
                    db.add(reaction)

            conv.last_message_at = msg_time
            return conv

        await create_group_conv(
            "Signal Dev Team 💻",
            "Building the next generation messaging app",
            ["alice", "bob", "charlie", "diana", "eve", "frank"],
            SIGNAL_DEV_TEAM_MESSAGES,
            6.0,
        )

        await create_group_conv(
            "Weekend Hikers 🏔️",
            "Trail adventures and outdoor fun",
            ["bob", "grace", "henry"],
            WEEKEND_HIKERS_MESSAGES,
            4.0,
        )

        await db.commit()
        print("✓ Created 2 group conversations")

    print("\n✅ Database seeded successfully!")
    print("\n📋 Test Accounts:")
    print("   All users use OTP: 123456")
    print("\n   Users:")
    for u_data in USERS:
        print(f"   📱 {u_data['phone']} — {u_data['display_name']} (@{u_data['username']})")


if __name__ == "__main__":
    asyncio.run(seed())
