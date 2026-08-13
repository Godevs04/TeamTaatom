/** Journey — loosely typed for API variance */

export type JourneyCoord = {
  lat: number;
  lng: number;
  timestamp?: string | Date | number;
  accuracy?: number | null;
};

/** Shape of `waypoints.post` as populated by getJourneyDetail's select:
 * 'caption imageUrl images videoUrl thumbnailUrl storageKey storageKeys type location mediaType' */
export type JourneyWaypointPost = {
  _id: string;
  caption?: string;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  storageKey?: string;
  storageKeys?: string[];
  type?: string;
  location?: { address?: string; coordinates?: { latitude?: number; longitude?: number } };
  mediaType?: string;
};

export type JourneyWaypoint = {
  post?: JourneyWaypointPost | null;
  lat: number;
  lng: number;
  timestamp?: string;
  contentType?: "photo" | "short" | "video";
};

export type Journey = {
  _id: string;
  user?: string;
  status?: "active" | "paused" | "completed";
  title?: string;
  polyline?: JourneyCoord[];
  distanceTraveled?: number;
  startedAt?: string;
  completedAt?: string;
  startCoords?: { lat: number; lng: number };
  waypoints?: JourneyWaypoint[];
};
