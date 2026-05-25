export const MAP_ACCENT = '#00F0FF';
export const MAP_ACCENT_SOFT = 'rgba(0, 240, 255, 0.24)';

export const midnightGlassMapStyle = [
  // Base environment / Landmass: #181818
  { elementType: 'geometry', stylers: [{ color: '#181818' }] },
  
  // Clean layout - hide default icons but show labels
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A8A8A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#181818' }] },
  
  // Administrative and cities
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#3A3A3A' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#8A8A8A' }] },
  
  // Landscape
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  
  // Suppress POIs (business, transit, etc.)
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  
  // Roads / Highways: #2A2A2A with dark borders
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#181818' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#181818' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#202020' }] },
  
  // Transit suppression
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  
  // Water Bodies: #101010
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#101010' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8A8A8A' }] },
];

export const calmMorningMapStyle = [
  // Land: #EEF2F6
  { elementType: 'geometry', stylers: [{ color: '#EEF2F6' }] },
  
  // Clean labels styled with #667085
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#667085' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  
  // Administrative and cities
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#CBD5E1' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#667085' }] },
  
  // Landscape
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EDF2F6' }] },
  
  // Suppress POIs but keep landmarks/parks
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#DDF6E8' }] },
  
  // Roads: Major roads are #FFFFFF, minor are #E8EDF2
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E2E8F0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#CBD5E1' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#E8EDF2' }] },
  
  // Transit suppression
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  
  // Water: #A8D8FF
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#A8D8FF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4F6B86' }] },
];

