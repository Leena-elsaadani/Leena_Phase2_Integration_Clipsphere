'use client';

import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface User {
  _id: string;
  username: string;
  email: string;
  bio: string;
  avatarUrl: string;
  role: string;
  notificationPreferences: {
    newFollower: boolean;
    newComment: boolean;
    newLike: boolean;
  };
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api('/users/me');
        setUser(res.data.user);
      } catch (err) {
        setUser(null);
        setError('Not authenticated');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed');
    }
  };

  return { user, loading, error, logout };
};