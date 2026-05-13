import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

export const useMessages = (roomId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchMessages = useCallback(async (reset = false) => {
    if (!roomId || (!reset && !hasMore)) return;

    try {
      setLoading(true);
      const response = await apiClient.get(`/rooms/${roomId}/messages`, {
        params: { cursor: reset ? null : cursor, limit: 20 }
      });
      const newMessages = response.data.messages || [];
      const nextCursor = response.data.nextCursor;

      setMessages(prev => reset ? newMessages : [...newMessages, ...prev]);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roomId, cursor, hasMore]);

  const addMessage = async (content) => {
    try {
      const response = await apiClient.post(`/rooms/${roomId}/messages`, { content });
      setMessages(prev => [response.data, ...prev]);
    } catch (err) {
      throw err;
    }
  };

  const editMessage = async (messageId, content) => {
    try {
      const response = await apiClient.put(`/rooms/${roomId}/messages/${messageId}`, { content });
      setMessages(prev => prev.map(msg => msg.id === messageId ? response.data : msg));
    } catch (err) {
      throw err;
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await apiClient.delete(`/rooms/${roomId}/messages/${messageId}`);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    if (roomId) {
      fetchMessages(true);
    }
  }, [roomId]);

  return {
    messages,
    setMessages,
    loading,
    error,
    hasMore,
    fetchMore: () => fetchMessages(false),
    addMessage,
    editMessage,
    deleteMessage
  };
};