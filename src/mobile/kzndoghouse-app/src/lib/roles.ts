import type { UserRole } from '@/context/AuthContext';

export function isStaff(role: UserRole | null | undefined): boolean {
  return role === 'staff';
}