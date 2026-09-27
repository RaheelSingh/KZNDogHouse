import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'volunteer' | 'staff';

export type AppUser = {
  id: string; 
  name: string;
  email: string;
  role: UserRole; 
};

export type RegisterDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

type AuthContextValue = {
  session: AppUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (details: RegisterDetails) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;


async function fetchProfile(
  accessToken: string,
  fallback: { id: string; email: string }
): Promise<AppUser> {
  if (!API_BASE_URL) {
    console.warn(
      '[auth] EXPO_PUBLIC_API_BASE_URL not set — using fallback profile, role defaults to "volunteer".'
    );
    return { id: fallback.id, name: fallback.email, email: fallback.email, role: 'volunteer' };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`/api/me returned ${res.status}`);
    }

    const data = await res.json();
    const roleLower = String(data.role).toLowerCase();
    const role: UserRole = roleLower === 'staff' || roleLower === 'administrator' ? 'staff' : 'volunteer';

    return {
      id: data.id ?? fallback.id,
      name: data.name ?? fallback.email,
      email: fallback.email,
      role,
    };
  } catch (err) {
    console.warn('[auth] Could not reach /api/me, using fallback profile:', err);
    return { id: fallback.id, name: fallback.email, email: fallback.email, role: 'volunteer' };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;


    supabase.auth.getSession().then(async ({ data }) => {
      const supaSession = data.session;
      if (supaSession) {
        const profile = await fetchProfile(supaSession.access_token, {
          id: supaSession.user.id,
          email: supaSession.user.email ?? '',
        });
        if (mounted.current) setSession(profile);
      }
      if (mounted.current) setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, supaSession) => {
      if (!supaSession) {
        if (mounted.current) setSession(null);
        return;
      }
      const profile = await fetchProfile(supaSession.access_token, {
        id: supaSession.user.id,
        email: supaSession.user.email ?? '',
      });
      if (mounted.current) setSession(profile);
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // session state updates via the onAuthStateChange listener above
  };

  const register = async (details: RegisterDetails) => {
    const { firstName, lastName, email, phone, password } = details;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
          role: 'volunteer',
        },
      },
    });

    if (error) throw error;
    // session state updates via the onAuthStateChange listener above
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}