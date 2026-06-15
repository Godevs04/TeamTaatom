import { Platform } from 'react-native';
import * as Location from 'expo-location';
import logger from './logger';

export interface LoginLocationHint {
  city?: string;
  region?: string;
  country?: string;
  label?: string;
}

function formatGeocodedAddress(address: Location.LocationGeocodedAddress): LoginLocationHint {
  const city = address.city || address.subregion || address.district || undefined;
  const region = address.region || undefined;
  const country = address.country || undefined;
  const label = [city, region, country].filter(Boolean).join(', ');
  return {
    city,
    region,
    country,
    label: label || undefined,
  };
}

/**
 * Best-effort device location for login security emails.
 * Requests permission once if still undetermined; never blocks login on failure.
 */
export async function getLoginLocationHint(): Promise<LoginLocationHint | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
              { headers: { Accept: 'application/json' } }
            );
            const data = (await res.json()) as {
              address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
            };
            const addr = data.address;
            if (!addr) {
              resolve(null);
              return;
            }
            const city = addr.city || addr.town || addr.village || addr.state;
            const country = addr.country;
            const label = [city, country].filter(Boolean).join(', ');
            resolve(label ? { city, country, label } : null);
          } catch {
            resolve(null);
          }
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
      );
    });
  }

  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status === 'undetermined') {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      return null;
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
    const position =
      lastKnown ||
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));

    const [address] = await Location.reverseGeocodeAsync(position.coords);
    if (!address) return null;

    const hint = formatGeocodedAddress(address);
    return hint.label ? hint : null;
  } catch (error) {
    logger.debug('getLoginLocationHint failed:', error);
    return null;
  }
}
