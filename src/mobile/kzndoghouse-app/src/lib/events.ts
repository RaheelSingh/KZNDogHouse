import { supabase } from '@/lib/supabase';
import type { CalendarEvent, EventAssignment } from '@/types/models';

/** Columns every screen selects for an event, so lists and details stay consistent. */
export const EVENT_COLUMNS =
  'id, title, category, description, location, start_at, end_at, visibility, dog_id, created_by, created_at, volunteer_signup_enabled, max_volunteers, volunteer_start_at, volunteer_end_at, volunteer_notes';

/** Check-in opens this long before the event starts (must match check_in_to_event in SQL). */
const CHECK_IN_OPENS_BEFORE_MS = 60 * 60 * 1000;
/** Events without an end time are treated as lasting this long (must match SQL). */
const DEFAULT_EVENT_LENGTH_MS = 12 * 60 * 60 * 1000;

export type SignupState = 'joined' | 'pending' | 'reserve' | 'declined' | 'open' | 'full' | 'closed' | 'started';

type EventTiming = Pick<CalendarEvent, 'start_at' | 'end_at'>;
type EventSignupInfo = Pick<CalendarEvent, 'start_at' | 'volunteer_signup_enabled' | 'max_volunteers'>;

// ---------------------------------------------------------------------------
// Pure helpers (no network) - safe to call during render
// ---------------------------------------------------------------------------

export function isActiveAssignment(assignment: Pick<EventAssignment, 'status'> | null | undefined): boolean {
  return !!assignment && assignment.status !== 'Cancelled';
}

export function hasStarted(event: Pick<CalendarEvent, 'start_at'>, now: number = Date.now()): boolean {
  return new Date(event.start_at).getTime() <= now;
}

export function isCheckInOpen(event: EventTiming, now: number = Date.now()): boolean {
  const start = new Date(event.start_at).getTime();
  const end = event.end_at ? new Date(event.end_at).getTime() : start + DEFAULT_EVENT_LENGTH_MS;
  return now >= start - CHECK_IN_OPENS_BEFORE_MS && now <= end;
}

export function getSignupState(
  event: EventSignupInfo,
  myAssignment: Pick<EventAssignment, 'status'> | null | undefined,
  signedUpCount: number,
  now: number = Date.now()
): SignupState {
  if (myAssignment?.status === 'Pending') return 'pending';
  if (myAssignment?.status === 'Reserve') return 'reserve';
  if (myAssignment?.status === 'Declined') return 'declined';
  if (myAssignment && ['Assigned', 'Registered', 'Confirmed'].includes(myAssignment.status)) return 'joined';
  if (hasStarted(event, now)) return 'started';
  if (!event.volunteer_signup_enabled) return 'closed';
  // Applications can be submitted even when all confirmed places are filled.
  // Staff may still place applicants on standby.
  return 'open';
}

/** e.g. "3/10 spots filled", "4 signed up", or null when sign-ups are off. */
export function spotsLabel(
  event: Pick<CalendarEvent, 'volunteer_signup_enabled' | 'max_volunteers'>,
  signedUpCount: number
): string | null {
  if (!event.volunteer_signup_enabled) return null;
  if (event.max_volunteers != null) return `${signedUpCount}/${event.max_volunteers} confirmed volunteers`;
  return `${signedUpCount} confirmed volunteers`;
}

/**
 * Turns a Supabase/Postgres error into something safe to show a user.
 * Only messages we wrote ourselves in SQL (P0001 / P0002) are shown as-is;
 * anything else gets the fallback so internal details never leak to the UI.
 */
export function toFriendlyMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const { code, message } = err as { code?: string; message?: string };

  if (typeof message === 'string' && /network request failed|failed to fetch/i.test(message)) {
    return 'No internet connection. Please try again.';
  }
  if ((code === 'P0001' || code === 'P0002') && typeof message === 'string' && message.length > 0) {
    return message;
  }
  if (code === '42501') {
    return "You don't have permission to do that.";
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Server calls - all checks (open, full, started, ownership) happen in SQL
// ---------------------------------------------------------------------------

export async function signUpForEvent(eventId: string): Promise<EventAssignment> {
  const { data, error } = await supabase.rpc('request_volunteer_place', { p_event_id: eventId });
  if (error) throw error;
  return data as EventAssignment;
}

export async function cancelEventSignup(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_volunteer_application', { p_event_id: eventId });
  if (error) throw error;
}

export async function checkInToEvent(eventId: string): Promise<string> {
  const { data, error } = await supabase.rpc('check_in_to_event', { p_event_id: eventId });
  if (error) throw error;
  return data as string;
}

/** Returns { [eventId]: activeSignupCount }. Events with no sign-ups are simply absent (treat as 0). */
export async function fetchSignupCounts(eventIds: string[]): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_confirmed_volunteer_counts', { p_event_ids: eventIds });
  if (error) throw error;

  const counts: Record<string, number> = {};
  ((data as { event_id: string; signed_up: number }[] | null) ?? []).forEach((row) => {
    counts[row.event_id] = row.signed_up;
  });
  return counts;
}