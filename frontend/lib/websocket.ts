// ============================================================
// WebSocket Client Hook
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from './store';
import type { Message, WSMessage } from './types';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT = 5;

  const {
    addMessage,
    updateMessageStatus,
    setTyping,
    setPresence,
    updateReaction,
    deleteMessage,
    token,
  } = useStore();

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      // Ping every 30s
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'new_message': {
            const message = msg.data as unknown as Message;
            addMessage(message.conversation_id, message);
            break;
          }
          case 'message_status': {
            const { message_id, user_id, status, conversation_id } = msg.data as {
              message_id: string;
              user_id: string;
              status: string;
              conversation_id: string;
            };
            updateMessageStatus(conversation_id, message_id, user_id, status);
            break;
          }
          case 'typing': {
            const { conversation_id, user_id, is_typing } = msg.data as {
              conversation_id: string;
              user_id: string;
              is_typing: boolean;
            };
            setTyping(conversation_id, user_id, is_typing);
            break;
          }
          case 'presence': {
            const { user_id, is_online, last_seen } = msg.data as {
              user_id: string;
              is_online: boolean;
              last_seen: string;
            };
            setPresence(user_id, { is_online, last_seen });
            break;
          }
          case 'reaction': {
            updateReaction(msg.data as Record<string, unknown>);
            break;
          }
          case 'message_deleted': {
            const { message_id, conversation_id } = msg.data as {
              message_id: string;
              conversation_id: string;
            };
            deleteMessage(conversation_id, message_id);
            break;
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      // silent
    };

    ws.onclose = () => {
      if (reconnectAttempts.current < MAX_RECONNECT) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };
  }, [token, addMessage, updateMessageStatus, setTyping, setPresence, updateReaction, deleteMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'typing', conversation_id: conversationId, is_typing: isTyping })
      );
    }
  }, []);

  const sendRead = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'read', conversation_id: conversationId })
      );
    }
  }, []);

  return { sendTyping, sendRead };
}
