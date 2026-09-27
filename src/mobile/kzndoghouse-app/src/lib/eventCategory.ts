import type { EventCategory } from '@/types/models';

export function getCategoryColor(category: EventCategory): { bg: string; text: string } {
  switch (category) {
    case 'Shift':
      return { bg: '#dcecdd', text: '#1f6b3a' };
    case 'Vet & Care':
      return { bg: '#f4d3cf', text: '#b3261e' };
    case 'Meeting':
      return { bg: '#dbe3f0', text: '#2b4a8a' };
    case 'Public Event':
      return { bg: '#e6dcc2', text: '#8a5a12' };
    default:
      return { bg: '#eeeeee', text: '#555555' };
  }
}