export const colors = {
  primary: '#CF4226',
  primaryPressed: '#B5371F',
  primarySoft: '#FFF0E9',
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F3',
  textPrimary: '#1F1F1F',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  border: '#E8E8E5',
  success: '#247A55',
  successSoft: '#E8F5ED',
  warning: '#9A5B0C',
  warningSoft: '#FFF2D7',
  error: '#B42318',
  errorSoft: '#FDECE9',
  dark: '#171717',
  overlay: 'rgba(0,0,0,0.4)',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
