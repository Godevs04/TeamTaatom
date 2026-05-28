export const MAP_ACCENT = '#38BDF8'; // Sky Blue
export const MAP_ACCENT_SOFT = 'rgba(56, 189, 248, 0.24)';

export const midnightGlassMapStyle = [
  // Deep navy oceans
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1220' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1B2C4D' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ visibility: 'off' }] },

  // Landmasses - deep navy/slate dark tones
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0F172A' }] },

  // Country Borders - subtle, non-dominating outlines
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#1E293B' }, { weight: 0.8 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },

  // Typography - soft slate text
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1220' }, { weight: 2 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#CBD5E1' }] },

  // Roads - dark, blending into the landmass
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0B1220' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }, { weight: 0.5 }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#0B1220' }] },

  // Suppress POIs and Transit
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export const calmMorningMapStyle = [
  // Soft light oceans
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#7EAADB' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4A7BB0' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#F8FAFC' }, { weight: 2 }] },

  // Landmasses - clean light gray/white
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F1F5F9' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#D2F1D2' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#A3D9A5' }] },

  // Country Borders - minimal and clean
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#E2E8F0' }, { weight: 0.8 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },

  // Typography - soft slate text
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 2 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },

  // Roads - light, unobtrusive
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E2E8F0' }, { weight: 0.5 }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },

  // Suppress POIs and Transit
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
