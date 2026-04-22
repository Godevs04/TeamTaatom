export interface Coordinate {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

export interface Journey {
  _id: string;
  userId: string;
  startCoords: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  description?: string;
  sourceUserId?: string;
  status: 'active' | 'paused' | 'completed';
  polyline: Coordinate[];
  waypoints: Array<{
    postId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    type: 'photo' | 'video';
  }>;
  distance: number; // in meters
  duration: number; // in seconds
  startTime: string;
  pausedTime?: string;
  resumedTime?: string;
  completedTime?: string;
  autoEndAt?: string; // 24hr countdown timestamp
  createdAt: string;
  updatedAt: string;
}

export interface JourneyState {
  journey: Journey | null;
  isTracking: boolean;
  isPaused: boolean;
  polyline: Coordinate[];
  distance: number; // in meters
  duration: number; // in seconds (updated periodically)
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
}
