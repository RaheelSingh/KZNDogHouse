import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { unregisterPushNotifications } from '@/lib/pushNotifications';

/** 'pending' = signed in but not yet approved as a volunteer (DB role 'Public' or unknown). */
export type UserRole = 'volunteer' | 'staff' | 'pending';

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
  dateOfBirth: string;
  interests: string[];
  note: string;
  password: string;
};

export type RegisterResult = { needsEmailConfirmation: boolean };

type AuthContextValue = {
  session: AppUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (details: RegisterDetails) => Promise<RegisterResult>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function mapRole(raw: unknown): UserRole {
  const role = String(raw ?? '').toLowerCase();
  if (role === 'staff' || role === 'administrator') return 'staff';
  if (role === 'volunteer') return 'volunteer';
  return 'pending'; // Public, Vet, missing - no volunteer access in the app
}

async function resolveProfileFromSupabase(fallback: { id: string; email: string }): Promise<AppUser> {
  const { data, error } = await supabase.rpc('current_profile_info');
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    console.warn('[auth] Could not resolve current_profile_info:', error);
    // Fail closed: an unknown profile never gets volunteer or staff access.
    return { id: fallback.id, name: fallback.email, email: fallback.email, role: 'pending' };
  }
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || fallback.email;
  return { id: row.id ?? fallback.id, name, email: row.email ?? fallback.email, role: mapRole(row.role) };
}

async function fetchProfile(accessToken: string, fallback: { id: string; email: string }): Promise<AppUser> {
  if (!API_BASE_URL) return resolveProfileFromSupabase(fallback);

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`/api/me returned ${res.status}`);

    const body = await res.json();
    const data = body?.data ?? body; // the API wraps results in { success, message, data }
    return {
      id: data.id ?? fallback.id,
      name: data.name ?? fallback.email,
      email: fallback.email,
      role: mapRole(data.role),
    };
  } catch (err) {
    console.warn('[auth] /api/me unavailable, using Supabase profile lookup:', err);
    return resolveProfileFromSupabase(fallback);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refresh tokens only while the app is in the foreground (Supabase React Native guidance).
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;

    // Fires INITIAL_SESSION on start, then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / USER_UPDATED.
    const { data: listener } = supabase.auth.onAuthStateChange((event, supaSession) => {
      // Never await Supabase calls inside this callback - it can deadlock the auth client.
      setTimeout(async () => {
        if (!active) return;

        if (!supaSession) {
          setSession(null);
          setIsLoading(false);
          return;
        }
        if (event === 'TOKEN_REFRESHED') return; // same user, profile unchanged

        const profile = await fetchProfile(supaSession.access_token, {
          id: supaSession.user.id,
          email: supaSession.user.email ?? '',
        });
        if (!active) return;
        setSession(profile);
        setIsLoading(false);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // session state updates via onAuthStateChange
  };

  const register = async (details: RegisterDetails): Promise<RegisterResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: details.email,
      password: details.password,
      options: {
        // Role is NEVER sent from the client. volunteer_interest makes handle_new_user
        // create the profile with volunteer_request_status = 'Pending' for staff to review.
        data: {
          first_name: details.firstName,
          last_name: details.lastName,
          phone: details.phone,
          date_of_birth: details.dateOfBirth,
          volunteer_interest: 'true',
          interests: details.interests,
          note: details.note,
        },
      },
    });
    if (error) throw error;

    // No session back = Supabase "Confirm email" is on; the user must verify first.
    return { needsEmailConfirmation: !data.session };
  };

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const supaSession = data.session;
    if (!supaSession) {
      setSession(null);
      return;
    }
    const profile = await fetchProfile(supaSession.access_token, {
      id: supaSession.user.id,
      email: supaSession.user.email ?? '',
    });
    setSession(profile);
  }, []);

  const signOut = async () => {
    // Stop pushes to this phone first - the RPC needs the user to still be signed in.
    await unregisterPushNotifications();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, register, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}