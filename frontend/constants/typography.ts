export type FontWeight = '400' | '500' | '600' | '700' | 'regular' | 'medium' | 'semibold' | 'bold';

export const getFontFamily = (weight: FontWeight = 'regular'): string => {
  switch (weight) {
    case '700':
    case 'bold':
      return 'PlusJakartaSans-Bold';
    case '600':
    case 'semibold':
      return 'PlusJakartaSans-SemiBold';
    case '500':
    case 'medium':
      return 'PlusJakartaSans-Medium';
    case '400':
    case 'regular':
    default:
      return 'PlusJakartaSans-Regular';
  }
};
