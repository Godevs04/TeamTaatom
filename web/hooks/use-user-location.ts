"use client";

import * as React from "react";

export type LocationPermission = "unknown" | "granted" | "prompt" | "denied" | "unsupported";
export type UserCoords = { latitude: number; longitude: number };

/**
 * Viewer location without an unsolicited prompt (mirrors mobile locale.tsx):
 * reads the current permission and only auto-locates when it is already granted.
 * `request()` asks the browser when the user explicitly opts in.
 */
export function useUserLocation() {
  const [coords, setCoords] = React.useState<UserCoords | null>(null);
  const [permission, setPermission] = React.useState<LocationPermission>("unknown");
  const [locating, setLocating] = React.useState(false);

  const locate = React.useCallback((onDenied?: () => void) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setPermission("granted");
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermission("denied");
          onDenied?.();
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const apply = (state: PermissionState) => {
      if (cancelled) return;
      setPermission(state);
      if (state === "granted") locate();
    };
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          status = result;
          apply(result.state);
          result.onchange = () => apply(result.state);
        })
        .catch(() => setPermission("prompt"));
    } else {
      setPermission("prompt");
    }
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [locate]);

  return { coords, permission, locating, request: locate };
}
