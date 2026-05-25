/** Cloud neumorphism tokens — aligned with cloud-neumorphism-design.html */
export const cloudDesign = {
  sky: '#000000',
  skyLight: '#F5F7FA',
  skyPale: '#F5F7FA',
  skyUltra: '#F5F7FA',
  blueDeep: '#000000',
  blueMid: '#667085',
  textDark: '#121212',
  textMid: '#667085',
  textMuted: '#667085',
  screenGradientLight: ['#F5F7FA', '#F5F7FA'] as const,
  screenGradientDark: ['#000000', '#000000', '#000000'] as const,
  buttonGradient: ['#1F2026', '#121318'] as const,
  shadowCard: {
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  shadowFloat: {
    shadowColor: 'rgba(0, 0, 0, 0.16)',
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
      fill: 'rgba(255, 255, 255, 0.40)',
      border: 'rgba(255, 255, 255, 0.60)',
      shadowColor: '#788CB4',
      shadowOpacity: 0.15,
      insetTop: 'rgba(255, 255, 255, 0.8)',
    },
    blurIntensity: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 0,
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
