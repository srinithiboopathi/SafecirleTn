/**
 * Geographic calculation utilities for SafeCircle AI Real-Time GPS Tracking.
 * Implements high-precision Haversine distance, bearing, cross-track polyline
 * projection, off-route detection, and formatting helpers.
 */

/**
 * Computes great-circle distance between two coordinates in meters using the Haversine formula.
 */
export function computeHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes forward azimuth/bearing from point 1 to point 2 in degrees (0 - 360).
 */
export function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));

  return (θ + 360) % 360;
}

/**
 * Projects a point onto a line segment [p1, p2].
 * Returns the closest projected [lat, lng] on the segment and distance in meters.
 */
function projectPointOnSegment(
  p: [number, number], // [lat, lng]
  p1: [number, number], // [lat, lng]
  p2: [number, number]  // [lat, lng]
): { point: [number, number]; distanceMeters: number; t: number } {
  const [lat, lng] = p;
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;

  // Flattened equirectangular approximation for small segments (< a few km)
  const degToRad = Math.PI / 180;
  const midLat = ((lat1 + lat2) / 2) * degToRad;
  const cosLat = Math.cos(midLat);

  // Convert to local meter offsets from p1
  const x2 = (lng2 - lng1) * degToRad * 6371000 * cosLat;
  const y2 = (lat2 - lat1) * degToRad * 6371000;
  const xp = (lng - lng1) * degToRad * 6371000 * cosLat;
  const yp = (lat - lat1) * degToRad * 6371000;

  const segLenSq = x2 * x2 + y2 * y2;
  if (segLenSq === 0) {
    return {
      point: p1,
      distanceMeters: computeHaversineMeters(lat, lng, lat1, lng1),
      t: 0
    };
  }

  // Projection scalar t clamped to [0, 1]
  const t = Math.max(0, Math.min(1, (xp * x2 + yp * y2) / segLenSq));
  const projLat = lat1 + (lat2 - lat1) * t;
  const projLng = lng1 + (lng2 - lng1) * t;

  return {
    point: [projLat, projLng],
    distanceMeters: computeHaversineMeters(lat, lng, projLat, projLng),
    t
  };
}

export interface RouteMatchResult {
  nearestPoint: [number, number]; // [lat, lng]
  distanceToRouteMeters: number;
  segmentIndex: number;
  distanceAlongRouteMeters: number;
  remainingDistanceMeters: number;
  totalRouteMeters: number;
  progressPercentage: number;
  isOffRoute: boolean;
  bearingAtPoint: number;
}

/**
 * Finds the nearest point on a polyline (coordinates as [lng, lat] from GeoJSON/OSRM).
 * Calculates real distance traveled, remaining distance, progress %, and off-route detection.
 */
export function findNearestPointOnPolyline(
  userCoords: [number, number], // [lat, lng]
  polylineCoordinates: [number, number][], // [[lng, lat], ...]
  accuracyMeters: number = 20,
  offRouteThresholdMeters: number = 65
): RouteMatchResult {
  if (!polylineCoordinates || polylineCoordinates.length === 0) {
    return {
      nearestPoint: userCoords,
      distanceToRouteMeters: 0,
      segmentIndex: 0,
      distanceAlongRouteMeters: 0,
      remainingDistanceMeters: 0,
      totalRouteMeters: 0,
      progressPercentage: 0,
      isOffRoute: false,
      bearingAtPoint: 0
    };
  }

  // Precompute segment lengths
  const segmentLengths: number[] = [];
  let totalRouteMeters = 0;
  for (let i = 0; i < polylineCoordinates.length - 1; i++) {
    const c1 = polylineCoordinates[i];
    const c2 = polylineCoordinates[i + 1];
    const len = computeHaversineMeters(c1[1], c1[0], c2[1], c2[0]);
    segmentLengths.push(len);
    totalRouteMeters += len;
  }

  let minDistanceMeters = Infinity;
  let bestPoint: [number, number] = [polylineCoordinates[0][1], polylineCoordinates[0][0]];
  let bestSegIdx = 0;
  let bestSegT = 0;

  for (let i = 0; i < polylineCoordinates.length - 1; i++) {
    const p1: [number, number] = [polylineCoordinates[i][1], polylineCoordinates[i][0]];
    const p2: [number, number] = [polylineCoordinates[i + 1][1], polylineCoordinates[i + 1][0]];
    const proj = projectPointOnSegment(userCoords, p1, p2);

    if (proj.distanceMeters < minDistanceMeters) {
      minDistanceMeters = proj.distanceMeters;
      bestPoint = proj.point;
      bestSegIdx = i;
      bestSegT = proj.t;
    }
  }

  // Distance along route up to best segment + partial segment
  let distanceAlongRoute = 0;
  for (let i = 0; i < bestSegIdx; i++) {
    distanceAlongRoute += segmentLengths[i] || 0;
  }
  distanceAlongRoute += (segmentLengths[bestSegIdx] || 0) * bestSegT;

  const remainingDistanceMeters = Math.max(0, totalRouteMeters - distanceAlongRoute);
  const progressPercentage = totalRouteMeters > 0
    ? Math.min(100, Math.max(0, (distanceAlongRoute / totalRouteMeters) * 100))
    : 0;

  // Dynamic off-route threshold: adjust for GPS accuracy noise
  const dynamicThreshold = Math.max(offRouteThresholdMeters, accuracyMeters * 1.4);
  const isOffRoute = minDistanceMeters > dynamicThreshold;

  // Bearing of the current segment
  const p1 = polylineCoordinates[bestSegIdx];
  const p2 = polylineCoordinates[Math.min(bestSegIdx + 1, polylineCoordinates.length - 1)];
  const bearingAtPoint = computeBearing(p1[1], p1[0], p2[1], p2[0]);

  return {
    nearestPoint: bestPoint,
    distanceToRouteMeters: Math.round(minDistanceMeters),
    segmentIndex: bestSegIdx,
    distanceAlongRouteMeters: Math.round(distanceAlongRoute),
    remainingDistanceMeters: Math.round(remainingDistanceMeters),
    totalRouteMeters: Math.round(totalRouteMeters),
    progressPercentage: Math.round(progressPercentage * 10) / 10,
    isOffRoute,
    bearingAtPoint
  };
}

/**
 * Filter out implausible GPS jumps (e.g., sudden movement faster than 160 km/h
 * or accuracy degrade beyond reasonable limits).
 */
export function isPlausibleGpsReading(
  newCoords: [number, number],
  newTimestamp: number,
  lastCoords: [number, number] | null,
  lastTimestamp: number | null,
  accuracy: number
): boolean {
  const [lat, lng] = newCoords;

  // Basic coordinate sanity check
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) // Null Island
  ) {
    return false;
  }

  // Reject readings only if accuracy is absurd (> 50,000 meters / 50 km)
  if (accuracy > 50000) {
    return false;
  }

  if (!lastCoords || !lastTimestamp) {
    return true;
  }

  const timeDeltaSeconds = (newTimestamp - lastTimestamp) / 1000;
  if (timeDeltaSeconds <= 0) return true;

  const distanceMeters = computeHaversineMeters(
    lastCoords[0],
    lastCoords[1],
    newCoords[0],
    newCoords[1]
  );

  const speedMps = distanceMeters / timeDeltaSeconds;
  const speedKmh = speedMps * 3.6;

  // Speed threshold: 250 km/h (e.g. high-speed rail/expressway).
  // Only reject for speed jumps if distance is large (> 500m) AND reported accuracy is tight (< 50m).
  // If accuracy is wide (e.g. switching cell towers/Wi-Fi), allow the update so user's map re-centers.
  if (speedKmh > 250 && distanceMeters > 500 && accuracy < 50) {
    return false;
  }

  return true;
}

/**
 * Formats horizontal accuracy into a user-friendly label.
 */
export function formatAccuracy(accuracyMeters: number | null): string {
  if (accuracyMeters === null || accuracyMeters === undefined) {
    return 'Accuracy Unknown';
  }
  const rounded = Math.round(accuracyMeters);
  if (rounded <= 15) {
    return `±${rounded}m · High Precision GPS`;
  }
  if (rounded <= 50) {
    return `±${rounded}m · Good Accuracy`;
  }
  if (rounded <= 200) {
    return `±${rounded}m · Wi-Fi / Moderate`;
  }
  if (rounded <= 1000) {
    return `±${(rounded / 1000).toFixed(1)}km · Network / Coarse`;
  }
  return `±${Math.round(rounded / 1000)}km · Regional IP`;
}

/**
 * Formats speed in km/h.
 */
export function formatSpeedKmh(speedMps: number | null): string {
  if (speedMps === null || speedMps === undefined || isNaN(speedMps) || speedMps < 0.2) {
    return '0 km/h';
  }
  const kmh = Math.round(speedMps * 3.6);
  return `${kmh} km/h`;
}

/**
 * Formats distance cleanly (m or km) like Google Maps.
 */
export function formatDistance(meters: number): string {
  if (!meters || isNaN(meters) || meters <= 0) return '0 m';
  if (meters < 1000) {
    return `${Math.max(1, Math.round(meters))} m`;
  }
  const km = meters / 1000;
  if (km >= 100) {
    return `${Math.round(km)} km`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Formats duration in seconds into a human-friendly Google Maps style string
 * e.g., "4 min", "1 hr 18 min", "45 sec"
 */
export function formatDuration(seconds: number, includeSecondsForShort = false): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '1 min';
  const totalSecs = Math.round(seconds);

  if (totalSecs < 60) {
    return includeSecondsForShort ? `${totalSecs} sec` : '1 min';
  }

  const totalMinutes = Math.round(totalSecs / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days} d ${remHours} hr` : `${days} d`;
  }
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}

/**
 * Computes realistic travel duration in seconds for Walk, Bike, and Car modes
 * based on actual road distance (meters).
 * - Walk ('walking'): ~4.8 km/h (1.33 m/s)
 * - Bike ('biking'): ~20 km/h (5.56 m/s) in city, ~26 km/h on longer routes
 * - Car ('driving'): ~34 km/h (9.44 m/s) in urban traffic, ~52 km/h on highway corridors
 */
export function computeModeDurationSeconds(
  distanceMeters: number,
  mode: 'walking' | 'biking' | 'driving',
  routeIndex: number = 0
): number {
  const dist = Math.max(50, distanceMeters || 0);
  // Subtle corridor traffic factor so secondary/bypass routes have realistic timing differences
  const corridorFactor = routeIndex === 0 ? 1.0 : routeIndex === 1 ? 1.06 : 1.12;

  if (mode === 'walking') {
    // 4.8 km/h = 1.333 m/s
    const walkSpeedMps = 1.333;
    return Math.max(60, Math.round((dist / walkSpeedMps) * corridorFactor));
  }

  if (mode === 'biking') {
    // 20 km/h (5.56 m/s) in urban streets, up to 25 km/h (6.94 m/s) for longer stretches
    const bikeSpeedMps = dist > 10000 ? 6.8 : 5.56;
    const intersectionDelay = Math.min(300, Math.round((dist / 1000) * 12));
    return Math.max(45, Math.round(((dist / bikeSpeedMps) + intersectionDelay) * corridorFactor));
  }

  // 'driving' (Car)
  // 34 km/h (9.44 m/s) in urban grid (< 8 km), scaling to 52 km/h (14.4 m/s) on longer highways
  const carSpeedMps = dist > 15000 ? 14.2 : dist > 6000 ? 11.2 : 9.44;
  const trafficSignalDelay = Math.min(480, Math.round((dist / 1000) * 18));
  return Math.max(40, Math.round(((dist / carSpeedMps) + trafficSignalDelay) * corridorFactor));
}

