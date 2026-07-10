import { encryptMessage, decryptMessage } from './crypto';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('signal_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const api = {
  auth: {
    requestOtp: (phone: string) =>
      request<{ message: string; hint: string; is_new_user: boolean }>('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),

    verifyOtp: (phone: string, otp: string) =>
      request<{
        requires_registration: boolean;
        access_token?: string;
        token_type?: string;
        user?: import('./types').User;
        phone?: string;
      }>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      }),

    register: (phone: string, otp: string, display_name: string, username?: string) =>
      request<{ access_token: string; token_type: string; user: import('./types').User }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ phone, otp, display_name, username }),
        }
      ),

    logout: () => request('/api/auth/logout', { method: 'POST' }),
    me: () => request<import('./types').User>('/api/auth/me'),
  },

  users: {
    search: (q: string) =>
      request<import('./types').User[]>(`/api/users/search?q=${encodeURIComponent(q)}`),

    updateProfile: (data: { display_name?: string; username?: string; bio?: string }) =>
      request<import('./types').User>('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    uploadAvatar: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return upload<import('./types').User>('/api/users/me/avatar', fd);
    },

    getUser: (id: string) => request<import('./types').User>(`/api/users/${id}`),
  },

  contacts: {
    list: () => request<import('./types').Contact[]>('/api/contacts'),

    add: (data: { phone?: string; username?: string; nickname?: string }) =>
      request<import('./types').Contact>('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    remove: (id: string) =>
      request(`/api/contacts/${id}`, { method: 'DELETE' }),
  },

  conversations: {
    list: async (archived = false) => {
      const convs = await request<import('./types').Conversation[]>(`/api/conversations?archived=${archived}`);
      return convs.map((c) => {
        if (c.last_message && c.last_message.content) {
          c.last_message.content = decryptMessage(c.last_message.content, c.id);
        }
        return c;
      });
    },

    create: (data: {
      type: 'direct' | 'group';
      member_ids: string[];
      name?: string;
      description?: string;
    }) =>
      request<import('./types').Conversation>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: async (id: string) => {
      const c = await request<import('./types').Conversation>(`/api/conversations/${id}`);
      if (c.last_message && c.last_message.content) {
        c.last_message.content = decryptMessage(c.last_message.content, c.id);
      }
      return c;
    },

    messages: async (id: string, before?: string, limit = 50) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (before) params.set('before', before);
      const msgs = await request<import('./types').Message[]>(
        `/api/conversations/${id}/messages?${params}`
      );
      return msgs.map((m) => {
        if (m.content) {
          m.content = decryptMessage(m.content, id);
        }
        return m;
      });
    },

    sendMessage: async (
      convId: string,
      data: { content?: string; type?: string; reply_to_id?: string }
    ) => {
      const payload = { ...data };
      if (payload.content && payload.type === 'text') {
        payload.content = encryptMessage(payload.content, convId);
      }
      const msg = await request<import('./types').Message>(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (msg.content) {
        msg.content = decryptMessage(msg.content, convId);
      }
      return msg;
    },

    update: (id: string, data: { name?: string; description?: string; disappearing_timer?: number }) =>
      request<import('./types').Conversation>(`/api/conversations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    addMember: (convId: string, userId: string) =>
      request(`/api/conversations/${convId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }),

    removeMember: (convId: string, userId: string) =>
      request(`/api/conversations/${convId}/members/${userId}`, { method: 'DELETE' }),

    markRead: (convId: string) =>
      request(`/api/conversations/${convId}/read`, { method: 'POST' }),

    toggleMute: (convId: string) =>
      request<{ is_muted: boolean }>(`/api/conversations/${convId}/mute`, { method: 'PATCH' }),

    togglePin: (convId: string) =>
      request<{ is_pinned: boolean }>(`/api/conversations/${convId}/pin`, { method: 'PATCH' }),
  },

  messages: {
    addReaction: (messageId: string, emoji: string) =>
      request(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }),

    removeReaction: (messageId: string, emoji: string) =>
      request(`/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
        method: 'DELETE',
      }),

    delete: (messageId: string) =>
      request(`/api/messages/${messageId}`, { method: 'DELETE' }),

    uploadAttachment: (messageId: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return upload(`/api/messages/${messageId}/attachments`, fd);
    },
  },
};

export default api;
