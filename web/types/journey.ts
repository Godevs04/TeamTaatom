/** Journey — loosely typed for API variance */

export type JourneyCoord = {
  lat: number;
  lng: number;
  timestamp?: string | Date | number;
  accuracy?: number | null;
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
};
