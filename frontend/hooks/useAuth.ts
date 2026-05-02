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
  listeners.forEach((listener) => listener({ ...authState }));
};

const setAuthState = (next: Partial<AuthState>) => {
  authState = { ...authState, ...next };
  emit();
};

const fetchCurrentUser = async (force = false): Promise<void> => {
  if (!force && initialized) return;
  if (pendingFetch && !force) return pendingFetch;

  setAuthState({ loading: true, error: '' });

  pendingFetch = (async () => {
    try {
      const res = await api('/users/me');
      setAuthState({ user: res.data.user, error: '', loading: false });
    } catch (err) {
      setAuthState({ user: null, error: 'Not authenticated', loading: false });
    } finally {
      initialized = true;
      pendingFetch = null;
    }
  })();

  return pendingFetch;
};

export const refreshAuth = async () => {
  initialized = false;
  await fetchCurrentUser(true);
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({ ...authState });

  useEffect(() => {
    setState({ ...authState });
    listeners.add(setState);
    if (!initialized) {
      fetchCurrentUser();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed');
    } finally {
      initialized = true;
      setAuthState({ user: null, loading: false, error: '' });
      window.location.href = '/login';
    }
  };

  return { user: state.user, loading: state.loading, error: state.error, logout, refreshAuth };
};