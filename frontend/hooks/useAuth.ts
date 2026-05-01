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

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string;
}

let authState: AuthState = {
  user: null,
  loading: true,
  error: '',
};

let initialized = false;
let pendingFetch: Promise<void> | null = null;
const listeners = new Set<(state: AuthState) => void>();

const emit = () => {
  listeners.forEach((listener) => listener(authState));
};

const setAuthState = (next: Partial<AuthState>) => {
  authState = { ...authState, ...next };
  emit();
};

const fetchCurrentUser = async (force = false) => {
  if (!force && initialized) return;
  if (pendingFetch) return pendingFetch;

  setAuthState({ loading: true, error: '' });

  pendingFetch = (async () => {
    try {
      const res = await api('/users/me');
      setAuthState({ user: res.data.user, error: '' });
    } catch (err) {
      setAuthState({ user: null, error: 'Not authenticated' });
    } finally {
      initialized = true;
      setAuthState({ loading: false });
      pendingFetch = null;
    }
  })();

  return pendingFetch;
};

export const refreshAuth = async () => {
  await fetchCurrentUser(true);
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    listeners.add(setState);
    fetchCurrentUser();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      initialized = true;
      setAuthState({ user: null, loading: false, error: 'Not authenticated' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed');
    }
  };

  return { user: state.user, loading: state.loading, error: state.error, logout, refreshAuth };
};