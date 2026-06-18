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
  // State: [lat, lng, velLat, velLng]
  private x: number[] = [0, 0, 0, 0];
  
  // State Covariance Matrix
  private P: number[][] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];

  // Process noise variance (expected physical velocity deviation in meters/second)
  private Q_metres_per_sec = 0.08;
  
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
   * Smooths incoming raw GPS coordinate updates.
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
    let qBase = 0.25; // Increased from 0.08 for more responsiveness (less over-smoothing)
    if (typeof speed === 'number') {
      if (speed < 0.4) {
        // High smoothing when stationary/idle
        qBase = 0.05; // Increased from 0.015
      } else {
        // Scale Q quadratically with speed to adapt to higher vehicle accelerations
        qBase = 0.25 * (1.0 + 0.15 * speed * speed);
      }
    }
    this.Q_metres_per_sec = qBase;

    // Inject heading-based speed projections into state vector velocity if available
    if (typeof speed === 'number' && speed >= 0 && typeof heading === 'number' && heading >= 0) {
      const headingRad = (heading * Math.PI) / 180.0;
      const METRES_PER_DEGREE = 111320.0;
      this.x[2] = (speed / METRES_PER_DEGREE) * Math.cos(headingRad);
      this.x[3] = (speed / METRES_PER_DEGREE) * Math.sin(headingRad);
    }

    // --- 1. PREDICT PHASE ---
    // State transition F: x_pred = x + vel * dt
    const x_pred = [
      this.x[0] + this.x[2] * dt,
      this.x[1] + this.x[3] * dt,
      this.x[2],
      this.x[3]
    ];

    // Compute Pred Covariance P_pred = F*P*F^T + Q
    const Q = this.getQ(dt);
    const P_pred = [
      [
        this.P[0][0] + dt * (this.P[2][0] + this.P[0][2] + dt * this.P[2][2]) + Q[0][0],
        this.P[0][1] + dt * (this.P[2][1] + this.P[0][3] + dt * this.P[2][3]) + Q[0][1],
        this.P[0][2] + dt * this.P[2][2] + Q[0][2],
        this.P[0][3] + dt * this.P[2][3] + Q[0][3]
      ],
      [
        this.P[1][0] + dt * (this.P[3][0] + this.P[1][2] + dt * this.P[3][2]) + Q[1][0],
        this.P[1][1] + dt * (this.P[3][1] + this.P[1][3] + dt * this.P[3][3]) + Q[1][1],
        this.P[1][2] + dt * this.P[3][2] + Q[1][2],
        this.P[1][3] + dt * this.P[3][3] + Q[1][3]
      ],
      [
        this.P[2][0] + dt * this.P[2][2] + Q[2][0],
        this.P[2][1] + dt * this.P[2][3] + Q[2][1],
        this.P[2][2] + Q[2][2],
        this.P[2][3] + Q[2][3]
      ],
      [
        this.P[3][0] + dt * this.P[3][2] + Q[3][0],
        this.P[3][1] + dt * this.P[3][3] + Q[3][1],
        this.P[3][2] + Q[3][2],
        this.P[3][3] + Q[3][3]
      ]
    ];

    // --- 2. MEASUREMENT UPDATE PHASE ---
    // Conversion: 1 degree latitude = 111320 meters
    const METRES_PER_DEGREE = 111320.0;
    const rVar = (accuracy / METRES_PER_DEGREE) * (accuracy / METRES_PER_DEGREE);

    // Innovation covariance: S = H * P_pred * H^T + R
    // H = [1 0 0 0; 0 1 0 0] mapping positions to measurement dimensions
    const S = [
      [P_pred[0][0] + rVar, P_pred[0][1]],
      [P_pred[1][0], P_pred[1][1] + rVar]
    ];

    // Matrix Determinant for S
    const det = S[0][0] * S[1][1] - S[0][1] * S[1][0];
    if (det === 0) return { latitude: this.x[0], longitude: this.x[1] };
    
    // Invert S
    const S_inv = [
      [S[1][1] / det, -S[0][1] / det],
      [-S[1][0] / det, S[0][0] / det]
    ];

    // Kalman Gain: K = P_pred * H^T * S_inv
    const K = [
      [P_pred[0][0] * S_inv[0][0] + P_pred[0][1] * S_inv[1][0], P_pred[0][0] * S_inv[0][1] + P_pred[0][1] * S_inv[1][1]],
      [P_pred[1][0] * S_inv[0][0] + P_pred[1][1] * S_inv[1][0], P_pred[1][0] * S_inv[0][1] + P_pred[1][1] * S_inv[1][1]],
      [P_pred[2][0] * S_inv[0][0] + P_pred[2][1] * S_inv[1][0], P_pred[2][0] * S_inv[0][1] + P_pred[2][1] * S_inv[1][1]],
      [P_pred[3][0] * S_inv[0][0] + P_pred[3][1] * S_inv[1][0], P_pred[3][0] * S_inv[0][1] + P_pred[3][1] * S_inv[1][1]]
    ];

    // Compute innovation
    const inn = [
      lat - x_pred[0],
      lng - x_pred[1]
    ];

    // State update: X = X_pred + K * Innovation
    this.x = [
      x_pred[0] + K[0][0] * inn[0] + K[0][1] * inn[1],
      x_pred[1] + K[1][0] * inn[0] + K[1][1] * inn[1],
      x_pred[2] + K[2][0] * inn[0] + K[2][1] * inn[1],
      x_pred[3] + K[3][0] * inn[0] + K[3][1] * inn[1]
    ];

    // Covariance update: P = (I - KH) * P_pred
    const KH = [
      [K[0][0], K[0][1], 0, 0],
      [K[1][0], K[1][1], 0, 0],
      [K[2][0], K[2][1], 0, 0],
      [K[3][0], K[3][1], 0, 0]
    ];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += KH[i][k] * P_pred[k][j];
        }
        this.P[i][j] = P_pred[i][j] - sum;
      }
    }

    return { latitude: this.x[0], longitude: this.x[1] };
  }

  // Generate Process Noise Covariance (Q) based on dt
  private getQ(dt: number): number[][] {
    const METRES_PER_DEGREE = 111320.0;
    const qScale = (this.Q_metres_per_sec / METRES_PER_DEGREE) * (this.Q_metres_per_sec / METRES_PER_DEGREE);
    const dt2 = dt * dt;
    const dt3 = (dt2 * dt) / 2.0;
    const dt4 = (dt2 * dt2) / 4.0;

    return [
      [dt4 * qScale, 0, dt3 * qScale, 0],
      [0, dt4 * qScale, 0, dt3 * qScale],
      [dt3 * qScale, 0, dt2 * qScale, 0],
      [0, dt3 * qScale, 0, dt2 * qScale]
    ];
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
