/* eslint-disable react-refresh/only-export-components */
import { AuthKitProvider, useAuth as useWorkOSAuth } from '@workos-inc/authkit-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const DEMO_USER_STORAGE_KEY = 'aqquire.demo.user';
const DEFAULT_DEMO_USER: AuthUser = {
  id: 'demo_user',
  email: 'demo@aqquire.local',
  firstName: 'Demo',
  lastName: 'Member',
  profilePictureUrl:
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=60',
};

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

interface AuthContextValue {
  isLoading: boolean;
  user: AuthUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isDemoModeEnabled() {
  return import.meta.env.VITE_DEMO_MODE === '1' || !import.meta.env.VITE_WORKOS_CLIENT_ID;
}

function readDemoUser() {
  if (typeof window === 'undefined') {
    return DEFAULT_DEMO_USER;
  }

  const raw = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
  if (!raw) return DEFAULT_DEMO_USER;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.id || !parsed.email) return DEFAULT_DEMO_USER;
    return {
      id: parsed.id,
      email: parsed.email,
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      profilePictureUrl: parsed.profilePictureUrl ?? null,
    };
  } catch {
    return DEFAULT_DEMO_USER;
  }
}

function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readDemoUser());

  const signIn = useCallback(async () => {
    const next = readDemoUser();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(next));
    }
    setUser(next);
  }, []);

  const signOut = useCallback(async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: false,
      user,
      signIn,
      signOut,
    }),
    [user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function WorkOSAuthBridge({ children }: { children: ReactNode }) {
  const auth = useWorkOSAuth();

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: auth.isLoading,
      user: auth.user
        ? {
            id: auth.user.id,
            email: auth.user.email,
            firstName: auth.user.firstName,
            lastName: auth.user.lastName,
            profilePictureUrl: auth.user.profilePictureUrl,
          }
        : null,
      signIn: async () => {
        await Promise.resolve(auth.signIn());
      },
      signOut: async () => {
        await Promise.resolve(auth.signOut());
      },
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isDemoModeEnabled()) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }

  return (
    <AuthKitProvider
      clientId={import.meta.env.VITE_WORKOS_CLIENT_ID}
      redirectUri={import.meta.env.VITE_WORKOS_REDIRECT_URI}
    >
      <WorkOSAuthBridge>{children}</WorkOSAuthBridge>
    </AuthKitProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
