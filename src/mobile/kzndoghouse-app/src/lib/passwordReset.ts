import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Rule: one reset email per address every 5 minutes. Matches Supabase's 300-second setting. */
export const RESET_COOLDOWN_SECONDS = 5 * 60;

/** Set while the user is half-way through a reset (code checked, password not yet saved). */
export const RECOVERY_PENDING_KEY = 'kzn:password-recovery-pending';

const COOLDOWN_STORAGE_KEY = 'kzn:password-reset-cooldowns';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rule as the website's RegisterViewModel and the mobile register screen.
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Supabase codes are 6 digits on older projects and 8 on newer ones.
export const RESET_CODE_REGEX = /^\d{6,10}$/;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Turns 299 into "4:59". */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function readCooldowns(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(COOLDOWN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Seconds until this email may request another code (0 = allowed now). */
export async function getResetCooldownRemaining(email: string): Promise<number> {
  if (!email.trim()) return 0;
  const cooldowns = await readCooldowns();
  const availableAt = cooldowns[normaliseEmail(email)];
  if (typeof availableAt !== 'number') return 0;
  return Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
}

/** Starts the 5-minute wait for this email, and tidies away any finished waits. */
export async function startResetCooldown(email: string): Promise<void> {
  const cooldowns = await readCooldowns();
  const now = Date.now();
  const next: Record<string, number> = {};

  for (const [key, availableAt] of Object.entries(cooldowns)) {
    if (typeof availableAt === 'number' && availableAt > now) next[key] = availableAt;
  }

  next[normaliseEmail(email)] = now + RESET_COOLDOWN_SECONDS * 1000;

  try {
    await AsyncStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage failing is not fatal - Supabase still enforces the 5-minute rule.
  }
}

/** Counts down once a second. Call restart(seconds) to start again. */
export function useCountdown(initialSeconds = 0) {
  const [endAt, setEndAt] = useState(() => Date.now() + initialSeconds * 1000);
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, initialSeconds));

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  const restart = useCallback((seconds: number) => {
    setEndAt(Date.now() + Math.max(0, seconds) * 1000);
  }, []);

  return { secondsLeft, restart };
}

/** Turns Supabase errors into messages a user understands. */
export function getPasswordResetErrorMessage(err: unknown, fallback: string): string {
  const e = (err ?? {}) as { message?: string; code?: string; status?: number };
  const message = e.message ?? '';
  const code = e.code ?? '';

  if (code === 'same_password' || /different from the old password/i.test(message)) {
    return 'Your new password must be different from your old password.';
  }
  if (code === 'weak_password' || (e.status === 422 && /password/i.test(message))) {
    return 'That password was rejected. Please choose a stronger one.';
  }
  if (code === 'otp_expired' || /token has expired|invalid/i.test(message)) {
    return 'That code is incorrect or has expired. Check the latest email we sent you, or request a new code.';
  }
  if (e.status === 429) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (/network|fetch|failed to fetch/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return fallback;
}