import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { unregisterPushNotifications } from '@/lib/pushNotifications';
import {
  RECOVERY_PENDING_KEY,
  RESET_COOLDOWN_SECONDS,
  getResetCooldownRemaining,
  normaliseEmail,
  startResetCooldown,
} from '@/lib/passwordReset';

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

/** sent = false means a code was already sent recently and the 5-minute wait is still running. */
export type PasswordResetRequestResult = { sent: boolean; retryAfterSeconds: number };

type AuthContextValue = {
  session: AppUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (details: RegisterDetails) => Promise<RegisterResult>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
  verifyPasswordResetCode: (email: string, code: string) => Promise<void>;
  completePasswordReset: (newPassword: string) => Promise<void>;
  cancelPasswordReset: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Accept environment URLs with or without trailing slashes.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

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

  // True between "code accepted" and "new password saved". While true, the
  // sign-in that verifyOtp performs is NOT treated as a normal sign-in, so the
  // app stays on the reset screens instead of jumping to the tabs.
  const recoveringRef = useRef(false);

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

        // The app was closed half-way through a password reset. That session only
        // exists because a code was checked - it must not count as a real sign-in.
        if (event === 'INITIAL_SESSION') {
          const pending = await AsyncStorage.getItem(RECOVERY_PENDING_KEY).catch(() => null);
          if (pending) {
            await AsyncStorage.removeItem(RECOVERY_PENDING_KEY).catch(() => undefined);
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            if (!active) return;
            setSession(null);
            setIsLoading(false);
            return;
          }
        }

        // Mid-reset: stay on the reset screens.
        if (recoveringRef.current) {
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
    // If someone backed out of a reset and signs in normally, leave recovery mode.
    recoveringRef.current = false;
    await AsyncStorage.removeItem(RECOVERY_PENDING_KEY).catch(() => undefined);

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

  // ---- Forgot password ----------------------------------------------------

  const requestPasswordReset = async (email: string): Promise<PasswordResetRequestResult> => {
    const cleanEmail = normaliseEmail(email);

    // Rule: only one code per email every 5 minutes (survives closing the app).
    const remaining = await getResetCooldownRemaining(cleanEmail);
    if (remaining > 0) return { sent: false, retryAfterSeconds: remaining };

    // Supabase replies "OK" even if no account uses this email, so nothing is revealed.
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      // Supabase's own 5-minute rule (Minimum interval per user = 300 seconds).
      const alreadySent = error.status === 429 && /for security purposes/i.test(error.message);
      if (!alreadySent) throw error;
    }

    await startResetCooldown(cleanEmail);
    return { sent: true, retryAfterSeconds: RESET_COOLDOWN_SECONDS };
  };

  const verifyPasswordResetCode = async (email: string, code: string) => {
    // Turn recovery mode on BEFORE verifying, because verifyOtp signs the user in.
    recoveringRef.current = true;
    await AsyncStorage.setItem(RECOVERY_PENDING_KEY, '1').catch(() => undefined);

    const { data, error } = await supabase.auth.verifyOtp({
      email: normaliseEmail(email),
      token: code.trim(),
      type: 'recovery',
    });

    if (error || !data.session) {
      recoveringRef.current = false;
      await AsyncStorage.removeItem(RECOVERY_PENDING_KEY).catch(() => undefined);
      throw error ?? new Error('That code is incorrect or has expired.');
    }
  };

  const completePasswordReset = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    // Stay in recovery mode on failure so the user can try a different password.
    if (error) throw error;

    // Sign out every OTHER phone or browser that was using the old password.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);

    recoveringRef.current = false;
    await AsyncStorage.removeItem(RECOVERY_PENDING_KEY).catch(() => undefined);

    // Load the profile - this sets the session and the app opens normally.
    await refreshProfile();
  };

  const cancelPasswordReset = async () => {
    // Throw away the half-finished reset session on this phone.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    recoveringRef.current = false;
    await AsyncStorage.removeItem(RECOVERY_PENDING_KEY).catch(() => undefined);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        signIn,
        register,
        refreshProfile,
        signOut,
        requestPasswordReset,
        verifyPasswordResetCode,
        completePasswordReset,
        cancelPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}