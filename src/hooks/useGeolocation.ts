import { useRealtimeGps, RealtimeGpsState } from './useRealtimeGps';

/**
 * Enhanced useGeolocation hook providing backward compatibility
 * with existing components while exposing real-time GPS capabilities.
 */
export function useGeolocation(autoStart: boolean = true) {
  const gps = useRealtimeGps(autoStart);

  return {
    coords: gps.coords,
    error: gps.errorMessage,
    accuracy: gps.accuracy,
    speed: gps.speed,
    heading: gps.heading,
    timestamp: gps.timestamp,
    isStale: gps.isStale,
    status: gps.status,
    statusLabel: gps.statusLabel,
    trackingMode: gps.trackingMode,
    locationSource: gps.locationSource,
    locationLabel: gps.locationLabel,
    startTracking: gps.startTracking,
    stopTracking: gps.stopTracking,
    refreshLocation: gps.refreshLocation,
    setManualLocation: gps.setManualLocation,
    retryGps: gps.retryGps,
    fullGps: gps
  };
}
