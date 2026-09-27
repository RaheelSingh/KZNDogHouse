export type DogStatus =
  | 'Available'
  | 'In Care'
  | 'Under Treatment'
  | 'Fostered'
  | 'Reserved'
  | 'Adopted';

export interface Dog {
  id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  estimated_age_years: number | null;
  gender: 'Male' | 'Female' | 'Unknown';
  size: string | null;
  weight_kg: number | null;
  eye_colour: string | null;
  temperament: string | null;
  about: string | null;
  kennel_location: string | null;
  intake_date: string;
  intake_type: string | null;
  status: DogStatus;
  is_vaccinated: boolean;
  photo_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export type MedicalRecordType = 'Vaccination' | 'Condition' | 'Medication' | 'Treatment note';

export interface DogMedicalRecord {
  id: string;
  dog_id: string;
  record_type: MedicalRecordType;
  title: string;
  details: string | null;
  vet_name: string | null;
  next_action_date: string | null;
  status: 'Active' | 'Resolved';
  created_by: string | null;
  created_at: string;
}

export interface DogNote {
  id: string;
  dog_id: string;
  author_id: string | null;
  note: string;
  created_at: string;
}

export interface FosteringRecord {
  id: string;
  dog_id: string;
  foster_profile_id: string | null;
  foster_name: string | null;
  start_date: string;
  end_date: string | null;
  feedback: string | null;
  status: 'Active' | 'Completed';
  created_by: string | null;
  created_at: string;
}

export type EventCategory = 'Shift' | 'Vet & Care' | 'Meeting' | 'Public Event' | 'Other';

export interface CalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  visibility: 'Internal' | 'Public';
  dog_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EventAssignment {
  id: string;
  event_id: string;
  profile_id: string;
  status: 'Assigned' | 'Registered' | 'Confirmed' | 'Cancelled';
  checked_in_at: string | null;
  created_at: string;
}

export type AvailabilitySlotName = 'Morning' | 'Afternoon' | 'Evening';

export interface AvailabilitySlot {
  id: string;
  volunteer_id: string;
  week_start: string;
  day_date: string;
  slot: AvailabilitySlotName;
  status: 'Pending' | 'Approved' | 'Rejected';
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export type NotificationCategory = 'Medical' | 'Calendar' | 'Tasks' | 'Messages' | 'General';

export interface AppNotification {
  id: string;
  recipient_id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}