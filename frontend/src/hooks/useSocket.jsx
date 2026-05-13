import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth.jsx';

export const useSocket = (roomId, onMessage) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!roomId || !user) return;

    const wsUrl = `${import.meta.env.VITE_API_URL.replace('http', 'ws')}/ws?roomId=${roomId}&userId=${user.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [roomId, user, onMessage]);

  return { isConnected };
};