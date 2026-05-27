export const MAP_ACCENT = '#38BDF8'; // Sky Blue
export const MAP_ACCENT_SOFT = 'rgba(56, 189, 248, 0.24)';

export const midnightGlassMapStyle = [
  // Base environment / Landmass: #000000
  { elementType: 'geometry', stylers: [{ color: '#000000' }] },
  
  // Clean layout - hide default icons but show labels
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#38BDF8' }] }, // Sky Blue labels
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
  
  // Administrative and cities
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#1C73B4' }, { weight: 1 }] }, // Ocean Blue coastline borders
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#1C73B4' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#38BDF8' }] },
  
  // Landscape
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  
  // Suppress POIs
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  
  // Roads / Highways: 10% Sky Blue on Black is #051319
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#051319' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#000000' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#051319' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#000000' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#051319' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#02090C' }] },
  
  // Transit suppression
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  
  // Water Bodies: #000000
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#38BDF8' }] },
];

export const calmMorningMapStyle = [
  // Base environment / Landmass: #FFFFFF
  { elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  
  // Clean labels
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#1C73B4' }] }, // Ocean Blue labels
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  
  // Administrative and cities
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1C73B4' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#1C73B4' }, { weight: 1 }] }, // Ocean Blue coastline borders
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1C73B4' }] },
  
  // Landscape
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  
  // Suppress POIs
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  
  // Roads: 10% Sky Blue on White is #EBF6FD
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#EBF6FD' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#EBF6FD' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#EBF6FD' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#F5FAFE' }] },
  
  // Transit suppression
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  
  // Water Bodies: #FFFFFF
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1C73B4' }] },
];
