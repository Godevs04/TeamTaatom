// frontend/utils/kalmanFilter.ts

/**
 * 2D Kalman Filter for GPS Telemetry Sanitization.
 * 
 * State Vector (X):
 * [0] - latitude (degrees)
 * [1] - longitude (degrees)
 * [2] - velocity latitude (degrees/sec)
 * [3] - velocity longitude (degrees/sec)
 * 
 * This filter dynamically computes Kalman Gain between prediction models
 * and actual GPS coordinates, heavily weighing predictions when GPS accuracy
 * is poor, and smoothing out instantaneous device coordinate jumps.
 */
export class KalmanFilter {
  // State: [lat, lng, 0, 0] (4D for backward compatibility with serialization)
  private x: number[] = [0, 0, 0, 0];
  
  // State Covariance Matrix (4D for compatibility)
  private P: number[][] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];

  // Process noise standard deviation in meters/second (speed-adaptive)
  private Q_metres_per_sec = 1.5;
  
  // Last measurement timestamp in ms
  private lastTimestamp: number = 0;

  constructor(initialLat: number, initialLng: number, initialAccuracy: number, timestamp: number) {
    this.x = [initialLat, initialLng, 0, 0];
    const accVar = initialAccuracy * initialAccuracy;
    this.P = [
      [accVar, 0, 0, 0],
      [0, accVar, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    this.lastTimestamp = timestamp;
  }

  /**
   * Smooths incoming raw GPS coordinate updates using position-only Kalman model.
   * @param lat Raw latitude from GPS.
   * @param lng Raw longitude from GPS.
   * @param accuracy Raw accuracy radius in meters.
   * @param timestamp Measurement timestamp in milliseconds.
   * @returns Smoothed latitude and longitude coordinates.
   */
  public update(lat: number, lng: number, accuracy: number, timestamp: number, speed?: number, heading?: number): { latitude: number; longitude: number } {
    if (this.lastTimestamp === 0) {
      this.x = [lat, lng, 0, 0];
      this.lastTimestamp = timestamp;
      return { latitude: lat, longitude: lng };
    }

    const dt = (timestamp - this.lastTimestamp) / 1000.0;
    if (dt <= 0) {
      return { latitude: this.x[0], longitude: this.x[1] };
    }
    this.lastTimestamp = timestamp;

    // Adaptive process noise scale based on velocity (m/s)
    let qBase = 1.5; // Walking speed standard deviation (approx 1.5 m/s)
    if (typeof speed === 'number' && speed >= 0) {
      if (speed < 0.4) {
        qBase = 0.2; // Low process noise when stationary/idle to filter out noise
      } else {
        qBase = Math.max(1.5, speed); // Adapt to fast movements (e.g. driving/cycling)
      }
    }
    this.Q_metres_per_sec = qBase;

    // --- 1. PREDICT PHASE (Position-Only) ---
    // Transition: position remains same, covariance grows by qVar * dt
    const METRES_PER_DEGREE = 111320.0;
    const qVar = (this.Q_metres_per_sec / METRES_PER_DEGREE) * (this.Q_metres_per_sec / METRES_PER_DEGREE) * dt;

    const lat_pred = this.x[0];
    const lng_pred = this.x[1];
    const latVar_pred = this.P[0][0] + qVar;
    const lngVar_pred = this.P[1][1] + qVar;

    // --- 2. MEASUREMENT UPDATE PHASE ---
    const rVar = (accuracy / METRES_PER_DEGREE) * (accuracy / METRES_PER_DEGREE);

    // Kalman Gain: K = P_pred / (P_pred + R)
    const K_lat = latVar_pred / (latVar_pred + rVar);
    const K_lng = lngVar_pred / (lngVar_pred + rVar);

    // State update: X = X_pred + K * (Measurement - X_pred)
    this.x[0] = lat_pred + K_lat * (lat - lat_pred);
    this.x[1] = lng_pred + K_lng * (lng - lng_pred);
    this.x[2] = 0; // Force velocity state to 0 (position-only tracking)
    this.x[3] = 0;

    // Covariance update: P = (1 - K) * P_pred
    this.P[0][0] = (1.0 - K_lat) * latVar_pred;
    this.P[1][1] = (1.0 - K_lng) * lngVar_pred;
    this.P[0][1] = 0;
    this.P[1][0] = 0;

    return { latitude: this.x[0], longitude: this.x[1] };
  }

  public toJSON(): any {
    return {
      x: this.x,
      P: this.P,
      Q_metres_per_sec: this.Q_metres_per_sec,
      lastTimestamp: this.lastTimestamp
    };
  }

  public static fromJSON(json: any): KalmanFilter {
    const filter = new KalmanFilter(json.x[0], json.x[1], 10, json.lastTimestamp);
    filter.x = [...json.x];
    filter.P = json.P.map((row: any) => [...row]);
    filter.Q_metres_per_sec = json.Q_metres_per_sec;
    return filter;
  }
}
