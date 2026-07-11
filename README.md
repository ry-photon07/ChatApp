# Signal Messenger Clone

A fully functional, visually faithful clone of the Signal messaging application built with a modern web stack. It replicates Signal's clean design, user experience, and core messaging workflows, including real-time communication, group chats, disappearing messages, rich attachment sharing, and user profile management.

---

## 🚀 Features

### 1. Onboarding & Authentication
*   **OTP Authentication Flow:** Replicates Signal's phone number registration.
*   **Verification Hint:** Simulates SMS verification with a friendly on-screen OTP code hint (`123456`).
*   **Profile Customization:** Prompts new users to set up a display name, username (`@handle`), and bio.

### 2. Rich Chat Interface (ChatPane & MessageBubble)
*   **Conversation Types:** Supports both 1-on-1 private chats and multi-user group chats.
*   **Message Types:** Send text, emojis, and media attachments.
*   **System Messages:** Automatically generates logs for group events (e.g., "Alice created the group").
*   **Replies & Threading:** Contextual message replies with a clean visual bubble highlighting the quoted content.
*   **Reactions & Emojis:** Quick emoji reactions (❤️, 😂, 👍, etc.) on hover, complete with counters and user tooltips.
*   **Message Deletion:** Fully supports "Delete for Everyone" for sent messages.
*   **Visual Grouping:** Automatically groups messages by date separators and bundles sequential messages by the same sender.

### 3. Dynamic Sidebar & Navigation
*   **Real-time Conversation List:** Virtualized, sorted list showing conversation status, last message preview, unread counts, and active presence.
*   **Search and Filter:** Quickly search chats by name or message contents.
*   **Pinned Chats:** Keep important conversations at the top.
*   **Mute Indicators:** Muted chats display a visual status and suppress unread notifications.
*   **Online Presence Indicator:** Displays real-time online status and "last seen" timestamps.
*   **Typing Indicators:** Clean animated typing bubbles showing who is typing (e.g., "Diana is typing...").

### 4. Advanced Group Workflows
*   **Group Info Drawer:** View member lists, roles (Admin/Member), and manage configuration.
*   **Member Management:** Admins can add or remove members in real time.
*   **Disappearing Messages:** Configure an admin-only timer (5 min, 1 hour, 1 day, 1 week, or Off) that deletes messages automatically when their lifespan expires.
*   **Mute / Unmute & Leave:** Leave groups or mute notifications at any time.

### 5. Media & Attachments
*   **Images:** Render inline image previews with modal viewing.
*   **Document Files:** Supports downloading PDFs, documents, text files, and zip files.
*   **Profile Avatar Upload:** Custom avatar uploading for users via their profile modal.

### 6. Design System & Theme
*   **Dark / Light Mode Toggle:** Seamless UI transition utilizing a customized theme provider that overrides design system tokens.
*   **Signal Design Language:** Follows the authentic Signal Messenger appearance with clean lines, borders, fonts, and a classic chat wall pattern.
*   **Deterministic Initials Avatars:** Automatically hashes initials into colored backgrounds for users without uploaded avatars.

---

## 🛠️ Tech Stack

*   **Frontend:** Next.js 14/15 (TypeScript, App Router), Zustand (State Management), Lucide Icons, Date-fns, React Hot Toast.
*   **Backend:** Python 3.12, FastAPI, SQLAlchemy (Async ORM), SQLite (database), WebSockets.
*   **Database Schema:** Contains 9 tables (`users`, `sessions`, `contacts`, `conversations`, `conversation_members`, `messages`, `message_statuses`, `message_reactions`, `attachments`).

---

## ⚙️ Setup & Execution Instructions

### Prerequisites
*   Python 3.10+
*   Node.js 18+

### Step 1: Clone & Navigate
```bash
git clone <repository-url>
cd SignalMessenger
```

### Step 2: Set up the Backend
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Seed the SQLite database with rich mock data:
    ```bash
    python seed.py
    ```
4.  Start the FastAPI dev server:
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

The API will be available at `http://localhost:8000`. You can inspect the interactive OpenAPI documentation at `http://localhost:8000/docs`.

### Step 3: Set up the Frontend
1.  Open a new terminal session and navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Set up environment variables:
    Create a `.env.local` file with the following variables:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:8000
    NEXT_PUBLIC_WS_URL=ws://localhost:8000
    ```
4.  Run the development server:
    ```bash
    npm run dev
    ```

Open `http://localhost:3000` in your web browser.

---
---

## 🔐 Authentication Method

This project uses a **mocked OTP-based login flow** to simulate Signal's phone verification, without needing a real SMS provider:

1. **Enter Phone Number:** User enters any of the seeded phone numbers (or a new one, which triggers registration).
2. **Mock OTP:** Instead of sending a real SMS, the app accepts a fixed OTP code: `123456` for all accounts. This is intentional and documented for testing/demo purposes.
3. **New vs Existing User:**
   - If the phone number matches a seeded user → logs in as that user.
   - If it's a new number → proceeds to profile setup (display name, username, bio).
4. **Session Persistence:** On successful OTP verification, the backend issues a session (stored via the `sessions` table) so the user stays logged in across refreshes.

**Note:** Real SMS-based verification and cryptographic key exchange are out of scope for this assignment and have been mocked, as explicitly permitted in the assignment brief.

## 📋 Test Accounts

All accounts use the OTP: `123456`. You can open multiple browser windows (e.g., incognito or different browsers) to test real-time WebSocket communication between these users:

| Name | Phone Number | Username | Role / Group Info |
| :--- | :--- | :--- | :--- |
| **Alice Greene** | `+1-555-0101` | `@alice_g` | Seeded in 2 groups & 4 direct chats |
| **Bob Martinez** | `+1-555-0102` | `@bob_m` | Seeded in group & direct chats |
| **Charlie Kim** | `+1-555-0103` | `@charlie_k` | Seeded in group & direct chats |
| **Diana Patel** | `+1-555-0104` | `@diana_p` | Seeded in group & direct chats |
| **Eve Johnson** | `+1-555-0105` | `@eve_j` | Available for direct messaging |
| **Frank Lee** | `+1-555-0106` | `@frank_l` | Available for direct messaging |
| **Grace Wilson** | `+1-555-0107` | `@grace_w` | Available for direct messaging |
| **Henry Brown** | `+1-555-0108` | `@henry_b` | Available for direct messaging |
