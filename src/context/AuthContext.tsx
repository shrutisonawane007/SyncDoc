'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Clear local IndexedDB cache when user changes to prevent cross-user data leaks
  useEffect(() => {
    if (!user) return;
    const currentId = user.id;
    
    async function checkUserChange() {
      try {
        const lastUserId = localStorage.getItem('last_logged_in_user_id');
        if (lastUserId && lastUserId !== currentId) {
          console.warn('User changed! Clearing local IndexedDB tables to prevent data leaks.');
          await Promise.all([
            db.documents.clear(),
            db.operations.clear(),
            db.syncQueue.clear(),
            db.versions.clear()
          ]);
        }
        localStorage.setItem('last_logged_in_user_id', currentId);
      } catch (e) {
        console.error('Failed to handle user transition in IndexedDB:', e);
      }
    }
    
    checkUserChange();
  }, [user]);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        router.push('/');
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch {
      return { success: false, error: 'An unexpected network error occurred.' };
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        router.push('/');
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Signup failed' };
      }
    } catch {
      return { success: false, error: 'An unexpected network error occurred.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      // Clear Dexie database immediately on logout to safeguard data
      try {
        await Promise.all([
          db.documents.clear(),
          db.operations.clear(),
          db.syncQueue.clear(),
          db.versions.clear()
        ]);
        localStorage.removeItem('last_logged_in_user_id');
      } catch (e) {
        console.error('Failed to clear IndexedDB on logout:', e);
      }
      setUser(null);
      router.push('/auth');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
export default AuthContext;
