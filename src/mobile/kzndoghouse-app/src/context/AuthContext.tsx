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

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function mapMobileRole(role: string): UserRole {
  const roleLower = role.trim().toLowerCase();

  if (roleLower === 'volunteer') {
    return 'volunteer';
  }

  if (roleLower === 'staff' || roleLower === 'administrator') {
    return 'staff';
  }

  throw new Error('This account does not currently have access to the mobile app.');
}

async function fetchProfile(accessToken: string): Promise<AppUser> {
  if (!API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not configured. Add the ASP.NET API address to the mobile environment file.'
    );
  }

  const res = await fetch(`${API_BASE_URL}/api/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = (await res.json().catch(() => null)) as ApiEnvelope<ProfileResponse> | null;

  if (!res.ok || !body?.success || !body.data) {
    throw new Error(body?.message || `Profile request failed with status ${res.status}.`);
  }

  return {
    id: body.data.id,
    name: body.data.name || body.data.email,
    email: body.data.email,
    role: mapMobileRole(body.data.role),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const loadInitialSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const supaSession = data.session;

        if (!supaSession) {
          if (mounted.current) setSession(null);
          return;
        }

        const profile = await fetchProfile(supaSession.access_token);
        if (mounted.current) setSession(profile);
      } catch (error) {
        console.warn('[auth] Mobile profile could not be loaded:', error);
        if (mounted.current) setSession(null);
      } finally {
        if (mounted.current) setIsLoading(false);
      }
    };

    void loadInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, supaSession) => {
      if (!supaSession) {
        if (mounted.current) setSession(null);
        return;
      }

      try {
        const profile = await fetchProfile(supaSession.access_token);
        if (mounted.current) setSession(profile);
      } catch (error) {
        console.warn('[auth] Signed-in account does not have valid mobile access:', error);
        if (mounted.current) setSession(null);
      }
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('No sign-in session was returned.');

    try {
      const profile = await fetchProfile(data.session.access_token);
      setSession(profile);
    } catch (error) {
      await supabase.auth.signOut();
      setSession(null);
      throw error;
    }
  };

  const register = async (details: RegisterDetails) => {
    const { firstName, lastName, email, phone, password } = details;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
          volunteer_interest: true,
        },
      },
    });

    if (error) throw error;

    if (data.session) {
      await supabase.auth.signOut();
    }

    setSession(null);
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
