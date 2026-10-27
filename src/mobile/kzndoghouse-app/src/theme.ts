import { Platform } from 'react-native';

export const colors = {
  header: '#12241c',
  primary: '#1f3d2e',
  cardGreen: '#2b4d3b',
  gold: '#b8892f',
  bg: '#eef0e9',
  white: '#ffffff',
  text: '#16201b',
  textMuted: '#6f7b73',
  border: '#dfe4dc',
  danger: '#b3261e',

  
  page: '#12241c',
  surface: '#1f3d2e',
  raised: '#2b4d3b',
  line: 'rgba(255,255,255,0.14)',
  fg: '#ffffff',
  fgMuted: 'rgba(255,255,255,0.7)',
  fgFaint: 'rgba(255,255,255,0.45)',
  dangerSoft: '#ff8a80',
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 28, pill: 999 };

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string,
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};