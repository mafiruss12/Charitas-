import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { apiFetch, setMemoryAuthToken } from '../lib/api';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { ChurchMembershipSummary, ThemeMode, UserProfile } from '../types/platform';

interface AuthContextValue {
  user: UserProfile | null;
  memberships: ChurchMembershipSummary[];
  activeChurchId: number | null;
  activeMembership: ChurchMembershipSummary | null;
  loading: boolean;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  setActiveChurchId: (id: number | null) => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    city?: string;
    invitationCode?: string;
    churchId?: number;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<ChurchMembershipSummary[]>([]);
  const [activeChurchId, setActiveChurchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemeMode>('light');

  const applyThemeToDom = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'dark');
    }
  }, []);

  const setTheme = useCallback(
    async (mode: ThemeMode) => {
      applyThemeToDom(mode);
      if (user) {
        try {
          await apiFetch('/api/auth/me', {
            method: 'PATCH',
            body: JSON.stringify({ preferredTheme: mode }),
          });
        } catch {
          // Non-fatal UI theme preference sync failure
        }
      }
    },
    [applyThemeToDom, user]
  );

  const loadMe = useCallback(
    async (tokenOverride?: string | null) => {
      const data = await apiFetch<{
        user: UserProfile;
        memberships: ChurchMembershipSummary[];
      }>('/api/auth/me', { token: tokenOverride });

      setUser(data.user);
      setMemberships(data.memberships);

      if (data.user.preferredTheme === 'dark' || data.user.preferredTheme === 'light') {
        applyThemeToDom(data.user.preferredTheme);
      }

      setActiveChurchId((prev) => {
        if (prev && data.memberships.some((m) => m.churchId === prev)) {
          return prev;
        }
        return data.memberships[0]?.churchId ?? null;
      });
    },
    [applyThemeToDom]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const idToken = await fbUser.getIdToken();
          setMemoryAuthToken(idToken);
          await loadMe(idToken);
        }
      } catch (err) {
        console.error('Firebase auth sync error:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadMe]);

  const activeMembership =
    memberships.find((m) => m.churchId === activeChurchId) ?? memberships[0] ?? null;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const primary = activeMembership?.churchPrimaryColor || '#1E3A5F';
      const accent = activeMembership?.churchAccentColor || '#B45309';
      document.documentElement.style.setProperty('--church-primary', primary);
      document.documentElement.style.setProperty('--church-accent', accent);
    }
  }, [activeMembership]);

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setMemoryAuthToken(idToken);
    await loadMe(idToken);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      token: null,
      body: JSON.stringify({ email, password }),
    });
    setMemoryAuthToken(data.token);
    await loadMe(data.token);
  };

  const registerWithEmail = async (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    city?: string;
    invitationCode?: string;
    churchId?: number;
  }) => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      token: null,
      body: JSON.stringify(payload),
    });
    setMemoryAuthToken(data.token);
    await loadMe(data.token);
  };

  const logout = async () => {
    setMemoryAuthToken(null);
    setUser(null);
    setMemberships([]);
    setActiveChurchId(null);
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch {
      // ignore firebase signout error
    }
  };

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      setMemoryAuthToken(idToken);
      await loadMe(idToken);
    } else {
      await loadMe();
    }
  }, [loadMe]);

  const hasPermission = useCallback(
    (perm: string) => {
      if (!user) return false;
      if (user.isPlatformSuperAdmin) return true;
      if (!activeMembership) return false;
      return activeMembership.permissions.includes(perm);
    },
    [activeMembership, user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeChurchId,
        activeMembership,
        loading,
        theme,
        setTheme,
        setActiveChurchId,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        refreshProfile,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
