import type { DogStatus } from '@/types/models';

export function getStatusColor(status: DogStatus): { bg: string; text: string } {
  switch (status) {
    case 'Available':
      return { bg: '#dcecdd', text: '#1f6b3a' };
    case 'In Care':
      return { bg: '#e3ece6', text: '#16302a' };
    case 'Under Treatment':
      return { bg: '#f4d3cf', text: '#b3261e' };
    case 'Fostered':
      return { bg: '#e6dcc2', text: '#8a5a12' };
    case 'Reserved':
      return { bg: '#dbe3f0', text: '#2b4a8a' };
    case 'Adopted':
      return { bg: '#e5e5e5', text: '#555555' };
    default:
      return { bg: '#eeeeee', text: '#333333' };
  }
}