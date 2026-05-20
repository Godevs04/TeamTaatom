/** Cloud neumorphism tokens — aligned with cloud-neumorphism-design.html */
export const cloudDesign = {
  sky: '#5BBCF8',
  skyLight: '#A8DAFC',
  skyPale: '#D9EFFF',
  skyUltra: '#EDF7FF',
  blueDeep: '#2B7FD4',
  blueMid: '#4BA3E8',
  textDark: '#1A2B3C',
  textMid: '#4A6274',
  textMuted: '#8FAABB',
  screenGradientLight: ['#A8DAFC', '#C8E8FF', '#EDF7FF', '#FFFFFF'] as const,
  screenGradientDark: ['#06121F', '#102236', '#07111C'] as const,
  buttonGradient: ['#5BBCF8', '#2B7FD4'] as const,
  shadowCard: {
    shadowColor: 'rgba(43, 127, 212, 0.14)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  shadowFloat: {
    shadowColor: 'rgba(43, 127, 212, 0.22)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 48,
    elevation: 12,
  },
  radius: {
    card: 24,
    md: 16,
    pill: 9999,
    postCard: 28,
  },
  /** Create-post glass card — matches web .card / .light-theme .card */
  postGlass: {
    dark: {
      fill: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.18)',
      shadowColor: '#000000',
      shadowOpacity: 0.25,
      insetTop: 'rgba(255,255,255,0.22)',
    },
    light: {
      fill: 'rgba(255,255,255,0.65)',
      border: 'rgba(255,255,255,0.9)',
      shadowColor: '#788CB4',
      shadowOpacity: 0.15,
      insetTop: 'rgba(255,255,255,0.8)',
    },
    blurIntensity: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 10,
  },
};

export function localeSubtitle(locale: {
  countryCode?: string;
  spotTypes?: string[];
  travelInfo?: string;
}): string {
  const parts: string[] = [];
  if (locale.spotTypes?.length) {
    parts.push(locale.spotTypes[0]);
  } else if (locale.countryCode) {
    parts.push(locale.countryCode);
  }
  if (locale.travelInfo) {
    parts.push(locale.travelInfo);
  }
  return parts.length ? parts.join(' • ') : locale.countryCode || 'Destination';
}
