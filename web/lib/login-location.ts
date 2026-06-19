/** Best-effort login location hint for security emails (mirrors mobile getLoginLocationHint). */
export async function getLoginLocationHint(): Promise<string | undefined> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return undefined;

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60_000,
      });
    });

    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  } catch {
    return undefined;
  }
}
