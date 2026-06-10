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
  // Landmasses - clean desaturated off-white/light gray (Uber-style)
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F2F2F2' }] },
  
  // Landcover / Natural areas (Forestry, forests, woodlands, vegetation) - soft premium green
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#C2E2C9' }] },
  { featureType: 'landscape.natural.landcover', elementType: 'geometry', stylers: [{ color: '#C2E2C9' }] },
  
  // Water - beautiful dark navy blue
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1D3557' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#A8DAD4' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#1D3557' }, { weight: 2 }] },

  // Parks and green spaces - lush green
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#A3D9B5' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3E5C45' }] },

  // Country and Locality Borders - minimal and desaturated
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#E2E8F0' }, { weight: 1.0 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },

  // Roads - clean white with very light desaturated borders
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E5E9EC' }, { weight: 0.6 }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#DFE4E8' }, { weight: 0.8 }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },

  // Labels & Typography - clean desaturated slate
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#526071' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 2 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#2C3E50' }] },

  // Suppress POIs and Transit
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
