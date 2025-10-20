// Comprehensive world coordinates database
const cityCoordinates: { [key: string]: { latitude: number; longitude: number } } = {
  // India
  'tuticorin': { latitude: 8.7642, longitude: 78.1348 },
  'thoothukudi': { latitude: 8.7642, longitude: 78.1348 },
  'erode': { latitude: 11.3410, longitude: 77.7172 },
  'bangalore': { latitude: 12.9716, longitude: 77.5946 },
  'bengaluru': { latitude: 12.9716, longitude: 77.5946 },
  'chennai': { latitude: 13.0827, longitude: 80.2707 },
  'madras': { latitude: 13.0827, longitude: 80.2707 },
  'mumbai': { latitude: 19.0760, longitude: 72.8777 },
  'delhi': { latitude: 28.7041, longitude: 77.1025 },
  'hyderabad': { latitude: 17.3850, longitude: 78.4867 },
  'kolkata': { latitude: 22.5726, longitude: 88.3639 },
  'pune': { latitude: 18.5204, longitude: 73.8567 },
  'ahmedabad': { latitude: 23.0225, longitude: 72.5714 },
  'jaipur': { latitude: 26.9124, longitude: 75.7873 },
  'coimbatore': { latitude: 11.0168, longitude: 76.9558 },
  'madurai': { latitude: 9.9252, longitude: 78.1198 },
  'salem': { latitude: 11.6643, longitude: 78.1460 },
  'tiruchirapalli': { latitude: 10.7905, longitude: 78.7047 },
  'tirunelveli': { latitude: 8.7139, longitude: 77.7567 },
  'thanjavur': { latitude: 10.7869, longitude: 79.1378 },
  
  // UK
  'bristol': { latitude: 51.4545, longitude: -2.5879 },
  'london': { latitude: 51.5074, longitude: -0.1278 },
  'manchester': { latitude: 53.4808, longitude: -2.2426 },
  'birmingham': { latitude: 52.4862, longitude: -1.8904 },
  'liverpool': { latitude: 53.4084, longitude: -2.9916 },
  'leeds': { latitude: 53.8008, longitude: -1.5491 },
  'glasgow': { latitude: 55.8642, longitude: -4.2518 },
  'edinburgh': { latitude: 55.9533, longitude: -3.1883 },
  'cardiff': { latitude: 51.4816, longitude: -3.1791 },
  'belfast': { latitude: 54.5973, longitude: -5.9301 },
  
  // USA
  'new york': { latitude: 40.7128, longitude: -74.0060 },
  'los angeles': { latitude: 34.0522, longitude: -118.2437 },
  'chicago': { latitude: 41.8781, longitude: -87.6298 },
  'houston': { latitude: 29.7604, longitude: -95.3698 },
  'phoenix': { latitude: 33.4484, longitude: -112.0740 },
  'philadelphia': { latitude: 39.9526, longitude: -75.1652 },
  'san antonio': { latitude: 29.4241, longitude: -98.4936 },
  'san diego': { latitude: 32.7157, longitude: -117.1611 },
  'dallas': { latitude: 32.7767, longitude: -96.7970 },
  'san jose': { latitude: 37.3382, longitude: -121.8863 },
  'austin': { latitude: 30.2672, longitude: -97.7431 },
  'jacksonville': { latitude: 30.3322, longitude: -81.6557 },
  'fort worth': { latitude: 32.7555, longitude: -97.3308 },
  'columbus': { latitude: 39.9612, longitude: -82.9988 },
  'charlotte': { latitude: 35.2271, longitude: -80.8431 },
  'san francisco': { latitude: 37.7749, longitude: -122.4194 },
  'indianapolis': { latitude: 39.7684, longitude: -86.1581 },
  'seattle': { latitude: 47.6062, longitude: -122.3321 },
  'denver': { latitude: 39.7392, longitude: -104.9903 },
  'washington': { latitude: 38.9072, longitude: -77.0369 },
  
  // Canada
  'toronto': { latitude: 43.6532, longitude: -79.3832 },
  'montreal': { latitude: 45.5017, longitude: -73.5673 },
  'vancouver': { latitude: 49.2827, longitude: -123.1207 },
  'calgary': { latitude: 51.0447, longitude: -114.0719 },
  'ottawa': { latitude: 45.4215, longitude: -75.6972 },
  'edmonton': { latitude: 53.5461, longitude: -113.4938 },
  'winnipeg': { latitude: 49.8951, longitude: -97.1384 },
  'quebec': { latitude: 46.8139, longitude: -71.2080 },
  'hamilton': { latitude: 43.2557, longitude: -79.8711 },
  'kitchener': { latitude: 43.4501, longitude: -80.4829 },
  
  // Australia
  'sydney': { latitude: -33.8688, longitude: 151.2093 },
  'melbourne': { latitude: -37.8136, longitude: 144.9631 },
  'brisbane': { latitude: -27.4698, longitude: 153.0251 },
  'perth': { latitude: -31.9505, longitude: 115.8605 },
  'adelaide': { latitude: -34.9285, longitude: 138.6007 },
  'gold coast': { latitude: -28.0167, longitude: 153.4000 },
  'newcastle': { latitude: -32.9267, longitude: 151.7789 },
  'canberra': { latitude: -35.2809, longitude: 149.1300 },
  'wollongong': { latitude: -34.4278, longitude: 150.8931 },
  'hobart': { latitude: -42.8821, longitude: 147.3272 },
  
  // Europe
  'paris': { latitude: 48.8566, longitude: 2.3522 },
  'berlin': { latitude: 52.5200, longitude: 13.4050 },
  'madrid': { latitude: 40.4168, longitude: -3.7038 },
  'rome': { latitude: 41.9028, longitude: 12.4964 },
  'amsterdam': { latitude: 52.3676, longitude: 4.9041 },
  'vienna': { latitude: 48.2082, longitude: 16.3738 },
  'brussels': { latitude: 50.8503, longitude: 4.3517 },
  'zurich': { latitude: 47.3769, longitude: 8.5417 },
  'stockholm': { latitude: 59.3293, longitude: 18.0686 },
  'copenhagen': { latitude: 55.6761, longitude: 12.5683 },
  'oslo': { latitude: 59.9139, longitude: 10.7522 },
  'helsinki': { latitude: 60.1699, longitude: 24.9384 },
  'warsaw': { latitude: 52.2297, longitude: 21.0122 },
  'prague': { latitude: 50.0755, longitude: 14.4378 },
  'budapest': { latitude: 47.4979, longitude: 19.0402 },
  'lisbon': { latitude: 38.7223, longitude: -9.1393 },
  'athens': { latitude: 37.9838, longitude: 23.7275 },
  'dublin': { latitude: 53.3498, longitude: -6.2603 },
  
  // Asia
  'tokyo': { latitude: 35.6762, longitude: 139.6503 },
  'seoul': { latitude: 37.5665, longitude: 126.9780 },
  'beijing': { latitude: 39.9042, longitude: 116.4074 },
  'shanghai': { latitude: 31.2304, longitude: 121.4737 },
  'hong kong': { latitude: 22.3193, longitude: 114.1694 },
  'singapore': { latitude: 1.3521, longitude: 103.8198 },
  'bangkok': { latitude: 13.7563, longitude: 100.5018 },
  'jakarta': { latitude: -6.2088, longitude: 106.8456 },
  'kuala lumpur': { latitude: 3.1390, longitude: 101.6869 },
  'manila': { latitude: 14.5995, longitude: 120.9842 },
  'ho chi minh city': { latitude: 10.8231, longitude: 106.6297 },
  'taipei': { latitude: 25.0330, longitude: 121.5654 },
  'dhaka': { latitude: 23.8103, longitude: 90.4125 },
  'karachi': { latitude: 24.8607, longitude: 67.0011 },
  'lahore': { latitude: 31.5204, longitude: 74.3587 },
  'islamabad': { latitude: 33.6844, longitude: 73.0479 },
  'kathmandu': { latitude: 27.7172, longitude: 85.3240 },
  'colombo': { latitude: 6.9271, longitude: 79.8612 },
  
  // Middle East & Africa
  'dubai': { latitude: 25.2048, longitude: 55.2708 },
  'riyadh': { latitude: 24.7136, longitude: 46.6753 },
  'cairo': { latitude: 30.0444, longitude: 31.2357 },
  'johannesburg': { latitude: -26.2041, longitude: 28.0473 },
  'cape town': { latitude: -33.9249, longitude: 18.4241 },
  'lagos': { latitude: 6.5244, longitude: 3.3792 },
  'nairobi': { latitude: -1.2921, longitude: 36.8219 },
  'casablanca': { latitude: 33.5731, longitude: -7.5898 },
  'tunis': { latitude: 36.8065, longitude: 10.1815 },
  'algiers': { latitude: 36.7538, longitude: 3.0588 },
  
  // South America
  'sao paulo': { latitude: -23.5505, longitude: -46.6333 },
  'rio de janeiro': { latitude: -22.9068, longitude: -43.1729 },
  'brazil': { latitude: -14.2350, longitude: -51.9253 },
  'buenos aires': { latitude: -34.6118, longitude: -58.3960 },
  'lima': { latitude: -12.0464, longitude: -77.0428 },
  'bogota': { latitude: 4.7110, longitude: -74.0721 },
  'santiago': { latitude: -33.4489, longitude: -70.6693 },
  'caracas': { latitude: 10.4806, longitude: -66.9036 },
  'quito': { latitude: -0.1807, longitude: -78.4678 },
  'la paz': { latitude: -16.2902, longitude: -68.1309 },
  'montevideo': { latitude: -34.9011, longitude: -56.1645 },
  
  // Additional popular destinations
  'istanbul': { latitude: 41.0082, longitude: 28.9784 },
  'moscow': { latitude: 55.7558, longitude: 37.6176 },
  'st petersburg': { latitude: 59.9311, longitude: 30.3609 },
  'kiev': { latitude: 50.4501, longitude: 30.5234 },
  'bucharest': { latitude: 44.4268, longitude: 26.1025 },
  'sofia': { latitude: 42.6977, longitude: 23.3219 },
  'zagreb': { latitude: 45.8150, longitude: 15.9819 },
  'ljubljana': { latitude: 46.0569, longitude: 14.5058 },
  'bratislava': { latitude: 48.1486, longitude: 17.1077 },
  'vilnius': { latitude: 54.6872, longitude: 25.2797 },
  'riga': { latitude: 56.9496, longitude: 24.1052 },
  'tallinn': { latitude: 59.4370, longitude: 24.7536 },
  'reykjavik': { latitude: 64.1466, longitude: -21.9426 },
  'luxembourg': { latitude: 49.6116, longitude: 6.1319 },
  'valletta': { latitude: 35.8989, longitude: 14.5146 },
  'nicosia': { latitude: 35.1856, longitude: 33.3823 },
  'andorra la vella': { latitude: 42.5063, longitude: 1.5218 },
  'san marino': { latitude: 43.9424, longitude: 12.4578 },
  'vatican city': { latitude: 41.9029, longitude: 12.4534 },
  'monaco': { latitude: 43.7384, longitude: 7.4246 },
  
  // Popular tourist destinations
  'barcelona': { latitude: 41.3851, longitude: 2.1734 },
  'florence': { latitude: 43.7696, longitude: 11.2558 },
  'venice': { latitude: 45.4408, longitude: 12.3155 },
  'milan': { latitude: 45.4642, longitude: 9.1900 },
  'naples': { latitude: 40.8518, longitude: 14.2681 },
  'palermo': { latitude: 38.1157, longitude: 13.3613 },
  'genoa': { latitude: 44.4056, longitude: 8.9463 },
  'turin': { latitude: 45.0703, longitude: 7.6869 },
  'bologna': { latitude: 44.4949, longitude: 11.3426 },
  'pisa': { latitude: 43.7228, longitude: 10.4017 },
  'siena': { latitude: 43.3188, longitude: 11.3307 },
  'verona': { latitude: 45.4384, longitude: 10.9916 },
  'padua': { latitude: 45.4064, longitude: 11.8768 },
  'ravenna': { latitude: 44.4184, longitude: 12.2035 },
  'ferrara': { latitude: 44.8381, longitude: 11.6196 },
  'modena': { latitude: 44.6471, longitude: 10.9252 },
  'parma': { latitude: 44.8015, longitude: 10.3279 },
  'reggio emilia': { latitude: 44.6989, longitude: 10.6297 },
  'mantua': { latitude: 45.1564, longitude: 10.7914 },
  'cremona': { latitude: 45.1327, longitude: 10.0225 },
  'brescia': { latitude: 45.5416, longitude: 10.2118 },
  'bergamo': { latitude: 45.6949, longitude: 9.6773 },
  'como': { latitude: 45.8081, longitude: 9.0852 },
  'varese': { latitude: 45.8206, longitude: 8.8251 },
  'pavia': { latitude: 45.1847, longitude: 9.1582 },
  'piacenza': { latitude: 45.0522, longitude: 9.6934 },
  'alessandria': { latitude: 44.9133, longitude: 8.6150 },
  'asti': { latitude: 44.8990, longitude: 8.2060 },
  'cuneo': { latitude: 44.3847, longitude: 7.5427 },
  'imperia': { latitude: 43.8897, longitude: 8.0395 },
  'savona': { latitude: 44.3080, longitude: 8.4800 },
  'la spezia': { latitude: 44.1025, longitude: 9.8248 },
  'mass': { latitude: 44.0300, longitude: 10.1400 },
  'carrara': { latitude: 44.0793, longitude: 10.0979 },
  'lucca': { latitude: 43.8430, longitude: 10.5079 },
  'livorno': { latitude: 43.5500, longitude: 10.3167 },
  'grosseto': { latitude: 42.7600, longitude: 11.1139 },
  'arezzo': { latitude: 43.4632, longitude: 11.8800 },
  'prato': { latitude: 43.8808, longitude: 11.0966 },
  'empoli': { latitude: 43.7167, longitude: 10.9500 },
  'pistoia': { latitude: 43.9333, longitude: 10.9167 },
  'pescara': { latitude: 42.4587, longitude: 14.2138 },
  'teramo': { latitude: 42.6588, longitude: 13.7038 },
  'l\'aquila': { latitude: 42.3505, longitude: 13.3995 },
  'chieti': { latitude: 42.3510, longitude: 14.1670 },
  'campobasso': { latitude: 41.5595, longitude: 14.6674 },
  'caserta': { latitude: 41.0732, longitude: 14.3329 },
  'benevento': { latitude: 41.1291, longitude: 14.7811 },
  'avellino': { latitude: 40.9152, longitude: 14.7898 },
  'salerno': { latitude: 40.6824, longitude: 14.7681 },
  'potenza': { latitude: 40.6418, longitude: 15.8079 },
  'matera': { latitude: 40.6667, longitude: 16.6000 },
  'taranto': { latitude: 40.4163, longitude: 17.2406 },
  'brindisi': { latitude: 40.6392, longitude: 17.9458 },
  'lecce': { latitude: 40.3570, longitude: 18.1720 },
  'foggia': { latitude: 41.4618, longitude: 15.5511 },
  'barletta': { latitude: 41.3200, longitude: 16.2800 },
  'andria': { latitude: 41.2312, longitude: 16.2979 },
  'trani': { latitude: 41.2800, longitude: 16.4200 },
  'bari': { latitude: 41.1177, longitude: 16.8719 },
  'bitonto': { latitude: 41.1100, longitude: 16.6900 },
  'molfetta': { latitude: 41.2000, longitude: 16.6000 },
  'cerignola': { latitude: 41.2700, longitude: 15.9000 },
  'canosa': { latitude: 41.2200, longitude: 16.0700 },
  'altamura': { latitude: 40.8300, longitude: 16.5500 },
  'gravina': { latitude: 40.8200, longitude: 16.4200 },
  'putignano': { latitude: 40.8500, longitude: 17.1200 },
  'conversano': { latitude: 40.9700, longitude: 17.1100 },
  'monopoli': { latitude: 40.9500, longitude: 17.3000 },
  'fasano': { latitude: 40.8300, longitude: 17.3600 },
  'ostuni': { latitude: 40.7300, longitude: 17.5800 },
  'crispiano': { latitude: 40.6000, longitude: 17.2300 },
  'martina franca': { latitude: 40.7000, longitude: 17.3300 },
  'locorotondo': { latitude: 40.7500, longitude: 17.3200 },
  'alberobello': { latitude: 40.7800, longitude: 17.2400 },
  'noci': { latitude: 40.8000, longitude: 17.1300 },
  'grottaglie': { latitude: 40.5300, longitude: 17.4300 },
  'francavilla fontana': { latitude: 40.5300, longitude: 17.5800 },
  'manduria': { latitude: 40.4000, longitude: 17.6300 },
  'sava': { latitude: 40.3700, longitude: 17.5500 },
  'san marzano': { latitude: 40.4500, longitude: 17.5000 },
  'leporano': { latitude: 40.3800, longitude: 17.3000 },
  'pulsano': { latitude: 40.3800, longitude: 17.3500 },
  'fragagnano': { latitude: 40.4300, longitude: 17.4700 },
  'carosino': { latitude: 40.4700, longitude: 17.4000 },
  'san giorgio ionico': { latitude: 40.4500, longitude: 17.3700 },
  'roccforzata': { latitude: 40.4200, longitude: 17.3900 },
  'monteiasi': { latitude: 40.5000, longitude: 17.3800 },
  'montemesola': { latitude: 40.5600, longitude: 17.3300 },
  'statte': { latitude: 40.5300, longitude: 17.2000 },
  'palagianello': { latitude: 40.6100, longitude: 16.9800 },
  'palagiano': { latitude: 40.6200, longitude: 17.0400 },
  'castellaneta': { latitude: 40.6300, longitude: 16.9300 },
  'ginosa': { latitude: 40.8200, longitude: 16.7500 },
  'laterza': { latitude: 40.6200, longitude: 16.8000 },
  'mottola': { latitude: 40.6400, longitude: 17.0300 },
  'massafra': { latitude: 40.5800, longitude: 17.1200 },
};

// Geocoding service with fallback to predefined coordinates
export const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const addressLower = address.toLowerCase().trim();
    
    // First try predefined coordinates
    for (const [city, coords] of Object.entries(cityCoordinates)) {
      if (addressLower.includes(city)) {
        console.log('Using predefined coordinates for:', city);
        return coords;
      }
    }
    
    // If not found in predefined list, return null (Google API commented out for now)
    // TODO: Enable Google Geocoding API when needed

    const GOOGLE_MAPS_API_KEY = 'AIzaSyBV-jFFSI6o--8SiXjzPYon8WH4slor9Co';
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log('Geocoding address via API:', address);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const coordinates = {
        latitude: location.lat,
        longitude: location.lng
      };
      
      console.log('API geocoding successful:', { address, coordinates });
      return coordinates;
    } else {
      console.error('API geocoding failed:', data.status, data.error_message);
      return null;
    }

    
    console.log('Address not found in offline database:', address);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Validate if coordinates seem reasonable for the given address
export const validateCoordinates = (address: string, latitude: number, longitude: number): boolean => {
  // Basic validation - check if coordinates are within reasonable bounds
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }
  
  const addressLower = address.toLowerCase().trim();
  
  // For Indian cities, check if coordinates match the expected region
  if (addressLower.includes('tuticorin') || addressLower.includes('thoothukudi')) {
    // Tuticorin, Tamil Nadu should be around 8.7642, 78.1348
    // If coordinates are in Bangalore area (around 12.9, 77.6), they're wrong
    if (latitude > 12 && latitude < 13 && longitude > 77 && longitude < 78) {
      console.log('Detected Tuticorin with Bangalore coordinates - invalid');
      return false;
    }
    // Tuticorin should be around 8-9 latitude, 78 longitude
    if (latitude < 8 || latitude > 10 || longitude < 77 || longitude > 79) {
      console.log('Tuticorin coordinates seem outside expected range');
      return false;
    }
  }
  
  if (addressLower.includes('erode')) {
    // Erode, Tamil Nadu should be around 11.3410, 77.7172
    if (latitude > 12 && latitude < 13 && longitude > 77 && longitude < 78) {
      console.log('Detected Erode with Bangalore coordinates - invalid');
      return false;
    }
    // Erode should be around 11-12 latitude, 77-78 longitude
    if (latitude < 10 || latitude > 12 || longitude < 77 || longitude > 78) {
      console.log('Erode coordinates seem outside expected range');
      return false;
    }
  }
  
  if (addressLower.includes('bangalore') || addressLower.includes('bengaluru')) {
    // Bangalore should be around 12.9716, 77.5946
    if (latitude < 12 || latitude > 14 || longitude < 77 || longitude > 78) {
      console.log('Bangalore coordinates seem outside expected range');
      return false;
    }
  }
  
  if (addressLower.includes('chennai') || addressLower.includes('madras')) {
    // Chennai should be around 13.0827, 80.2707
    if (latitude < 12 || latitude > 14 || longitude < 79 || longitude > 81) {
      console.log('Chennai coordinates seem outside expected range');
      return false;
    }
  }
  
  // For any address, if coordinates seem suspiciously close to Bangalore (12.9, 77.6)
  // and the address doesn't mention Bangalore, it's likely wrong
  if (!addressLower.includes('bangalore') && !addressLower.includes('bengaluru') && 
      !addressLower.includes('karnataka') && 
      latitude > 12.8 && latitude < 13.0 && longitude > 77.5 && longitude < 77.7) {
    console.log('Coordinates seem to be in Bangalore area but address is not Bangalore - likely wrong');
    return false;
  }
  
  return true;
};
