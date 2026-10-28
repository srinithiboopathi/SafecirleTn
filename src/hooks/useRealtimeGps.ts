import { useState, useEffect, useRef, useCallback } from 'react';
import { isPlausibleGpsReading, computeBearing, computeHaversineMeters } from '../utils/geoUtils';
import { api } from '../services/api';

export type GpsConnectionStatus =
  | 'idle'
  | 'prompt_explanation'
  | 'requesting'
  | 'waiting_for_fix'
  | 'connected'
  | 'low_accuracy'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'ip_fallback'
  | 'manual';

export type LocationSource = 'gps' | 'network' | 'ip' | 'manual' | 'simulated' | null;

export interface RealtimeGpsState {
  coords: [number, number] | null; // [latitude, longitude]
  accuracy: number | null; // horizontal accuracy in meters
  altitude: number | null; // altitude in meters
  speed: number | null; // speed in meters per second
  heading: number | null; // degrees 0-360
  timestamp: number | null; // epoch timestamp in ms
  isStale: boolean;
  status: GpsConnectionStatus;
  statusLabel: string;
  errorMessage: string | null;
  locationSource: LocationSource;
  locationLabel: string | null;
  isTracking: boolean;
  trackingMode: 'real' | 'demo';
  showExplanationModal: boolean;
  requestPermission: () => void;
  confirmRequestPermission: () => void;
  dismissExplanationModal: () => void;
  startTracking: (mode?: 'real' | 'demo') => void;
  stopTracking: () => void;
  setDemoMode: (isDemo: boolean) => void;
  refreshLocation: () => Promise<[number, number] | null>;
  setManualLocation: (coords: [number, number], label?: string) => void;
  retryGps: () => void;
}

const STALE_TIMEOUT_MS = 25000;
const MIN_DISTANCE_FOR_HEADING_ESTIMATE = 3.5;

export function useRealtimeGps(initialAutoStart: boolean = true): RealtimeGpsState {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [status, setStatus] = useState<GpsConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [trackingMode, setTrackingMode] = useState<'real' | 'demo'>('real');
  const [showExplanationModal, setShowExplanationModal] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const isHighAccuracyAttemptedRef = useRef<boolean>(true);
  const lastAcceptedCoordsRef = useRef<[number, number] | null>(null);
  const lastAcceptedTimeRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const staleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ipFallbackTriggeredRef = useRef<boolean>(false);

  // Reset the stale detection timer
  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
    }
    setIsStale(false);
    staleTimerRef.current = setTimeout(() => {
      setIsStale(true);
    }, STALE_TIMEOUT_MS);
  }, []);

  // IP-Based Fallback Location
  const fetchIpFallbackLocation = useCallback(async () => {
    if (ipFallbackTriggeredRef.current) return;
    ipFallbackTriggeredRef.current = true;

    try {
      // First try our backend proxy
      let lat = 0;
      let lng = 0;
      let city = '';
      let country = '';

      try {
        const ipRes = await api.getIpLocation();
        if (ipRes && ipRes.success && Array.isArray(ipRes.coords)) {
          lat = ipRes.coords[0];
          lng = ipRes.coords[1];
          city = ipRes.city;
          country = ipRes.country;
        }
      } catch {
        // Direct browser client fallback to ipwho.is
        const res = await fetch('https://ipwho.is/');
        const data = await res.json();
        if (data && data.success !== false && typeof data.latitude === 'number') {
          lat = data.latitude;
          lng = data.longitude;
          city = data.city || '';
          country = data.country || '';
        }
      }

      if (lat !== 0 && lng !== 0) {
        setCoords((prev) => {
          // Only apply IP fallback if real GPS has not already given coordinates
          if (!prev) {
            const locName = [city, country].filter(Boolean).join(', ') || 'Approximate Location';
            setLocationLabel(locName);
            setLocationSource('ip');
            setStatus('ip_fallback');
            setAccuracy(5000);
            setTimestamp(Date.now());
            return [lat, lng];
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('SafeCircle: IP geolocation fallback failed:', e);
    }
  }, []);

  // Stop tracking resources
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
    setIsTracking(false);
    setStatus('idle');
  }, []);

  // Handle successful browser GPS position
  const handleSuccess = useCallback(
    (position: GeolocationPosition, isStandardAccuracyFallback: boolean = false) => {
      const { latitude, longitude, accuracy: reportedAccuracy, altitude: repAlt, speed: repSpeed, heading: repHeading } = position.coords;
      const readingTimestamp = position.timestamp || Date.now();
      const newCoords: [number, number] = [latitude, longitude];

      // Plausibility check
      const isPlausible = isPlausibleGpsReading(
        newCoords,
        readingTimestamp,
        lastAcceptedCoordsRef.current,
        lastAcceptedTimeRef.current,
        reportedAccuracy
      );

      if (!isPlausible) {
        console.warn('SafeCircle GPS: Filtered out implausible reading:', {
          newCoords,
          accuracy: reportedAccuracy,
          prev: lastAcceptedCoordsRef.current
        });
        return;
      }

      // Heading resolution
      let resolvedHeading = lastHeadingRef.current;
      if (typeof repHeading === 'number' && !isNaN(repHeading) && repHeading >= 0) {
        resolvedHeading = repHeading;
      } else if (lastAcceptedCoordsRef.current) {
        const distMoved = computeHaversineMeters(
          lastAcceptedCoordsRef.current[0],
          lastAcceptedCoordsRef.current[1],
          latitude,
          longitude
        );
        if (distMoved >= MIN_DISTANCE_FOR_HEADING_ESTIMATE) {
          resolvedHeading = computeBearing(
            lastAcceptedCoordsRef.current[0],
            lastAcceptedCoordsRef.current[1],
            latitude,
            longitude
          );
        }
      }

      // Jitter Suppression for stationary user
      if (
        lastAcceptedCoordsRef.current &&
        reportedAccuracy > 10 &&
        (repSpeed === null || repSpeed < 0.4)
      ) {
        const jitterDist = computeHaversineMeters(
          lastAcceptedCoordsRef.current[0],
          lastAcceptedCoordsRef.current[1],
          latitude,
          longitude
        );
        if (jitterDist < 2.5) {
          setTimestamp(readingTimestamp);
          setAccuracy(reportedAccuracy);
          resetStaleTimer();
          return;
        }
      }

      lastAcceptedCoordsRef.current = newCoords;
      lastAcceptedTimeRef.current = readingTimestamp;
      if (resolvedHeading !== null) {
        lastHeadingRef.current = resolvedHeading;
      }

      setCoords(newCoords);
      setAccuracy(reportedAccuracy);
      setAltitude(repAlt ?? null);
      setSpeed(repSpeed ?? null);
      setHeading(resolvedHeading);
      setTimestamp(readingTimestamp);
      setErrorMessage(null);
      setLocationSource(isStandardAccuracyFallback || reportedAccuracy > 80 ? 'network' : 'gps');

      if (reportedAccuracy > 150) {
        setStatus('low_accuracy');
      } else {
        setStatus('connected');
      }

      resetStaleTimer();
    },
    [resetStaleTimer]
  );

  // Handle GPS errors from browser
  const handleError = useCallback(
    (err: GeolocationPositionError) => {
      console.warn('SafeCircle GPS Error:', err.code, err.message);

      // If high accuracy failed with timeout or unavailable, attempt standard accuracy
      if (isHighAccuracyAttemptedRef.current && (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE)) {
        isHighAccuracyAttemptedRef.current = false;
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
          }
          try {
            const id = navigator.geolocation.watchPosition(
              (pos) => handleSuccess(pos, true),
              (fallbackErr) => {
                setStatus('unavailable');
                setErrorMessage('GPS temporarily unavailable. Using network location.');
                fetchIpFallbackLocation();
              },
              { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
            );
            watchIdRef.current = id;
            return;
          } catch (e) {
            // continue
          }
        }
      }

      switch (err.code) {
        case err.PERMISSION_DENIED:
          setStatus('denied');
          setErrorMessage('Location permission was denied in your browser. Using approximate location or set your location manually.');
          fetchIpFallbackLocation();
          break;
        case err.POSITION_UNAVAILABLE:
          setStatus('unavailable');
          setErrorMessage('Device GPS fix is unavailable. Checking network location.');
          fetchIpFallbackLocation();
          break;
        case err.TIMEOUT:
          setStatus('timeout');
          setErrorMessage('GPS query timed out. Re-acquiring signal...');
          fetchIpFallbackLocation();
          break;
        default:
          setStatus('unavailable');
          setErrorMessage(err.message || 'Unable to retrieve GPS fix.');
          fetchIpFallbackLocation();
          break;
      }
    },
    [handleSuccess, fetchIpFallbackLocation]
  );

  // Start watching with two-tier strategy
  const startWatching = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      setErrorMessage('Geolocation is not supported by your browser.');
      fetchIpFallbackLocation();
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setStatus('waiting_for_fix');
    setIsTracking(true);
    setErrorMessage(null);
    isHighAccuracyAttemptedRef.current = true;

    // Stage 1: Quick one-shot position with standard accuracy (Wi-Fi / Cell fast cache)
    navigator.geolocation.getCurrentPosition(
      (pos) => handleSuccess(pos, true),
      () => {},
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 120000 }
    );

    // Stage 2: Continuous watch position with high accuracy
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => handleSuccess(pos, false),
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000
        }
      );
      watchIdRef.current = id;
    } catch (e: any) {
      setStatus('unavailable');
      setErrorMessage(e.message || 'Failed to start GPS tracking.');
      fetchIpFallbackLocation();
    }
  }, [handleSuccess, handleError, fetchIpFallbackLocation]);

  const requestPermission = useCallback(() => {
    startWatching();
  }, [startWatching]);

  const confirmRequestPermission = useCallback(() => {
    setShowExplanationModal(false);
    startWatching();
  }, [startWatching]);

  const dismissExplanationModal = useCallback(() => {
    setShowExplanationModal(false);
  }, []);

  const startTracking = useCallback(
    (mode: 'real' | 'demo' = 'real') => {
      setTrackingMode(mode);
      if (mode === 'real') {
        requestPermission();
      } else {
        setIsTracking(true);
        setStatus('connected');
        setLocationSource('simulated');
      }
    },
    [requestPermission]
  );

  // Single-shot location refresh
  const refreshLocation = useCallback(async (): Promise<[number, number] | null> => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return null;
    }

    setStatus('waiting_for_fix');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos, false);
          resolve([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          // If high accuracy failed, try low accuracy immediately
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              handleSuccess(pos, true);
              resolve([pos.coords.latitude, pos.coords.longitude]);
            },
            (fallbackErr) => {
              handleError(fallbackErr);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }, [handleSuccess, handleError]);

  // Set manual location override (e.g. from search or map click)
  const setManualLocation = useCallback((manualCoords: [number, number], label?: string) => {
    setCoords(manualCoords);
    setAccuracy(10);
    setTimestamp(Date.now());
    setStatus('manual');
    setLocationSource('manual');
    if (label) setLocationLabel(label);
    setErrorMessage(null);
    lastAcceptedCoordsRef.current = manualCoords;
    lastAcceptedTimeRef.current = Date.now();
  }, []);

  // Retry GPS
  const retryGps = useCallback(() => {
    setErrorMessage(null);
    startWatching();
  }, [startWatching]);

  const setDemoMode = useCallback(
    (isDemo: boolean) => {
      if (isDemo) {
        setTrackingMode('demo');
        setLocationSource('simulated');
      } else {
        setTrackingMode('real');
        requestPermission();
      }
    },
    [requestPermission]
  );

  useEffect(() => {
    if (initialAutoStart) {
      startWatching();
    }
  }, [initialAutoStart, startWatching]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
      }
    };
  }, []);

  const statusLabel = (() => {
    if (trackingMode === 'demo') return 'DEMO MODE (Simulated)';
    switch (status) {
      case 'connected':
        return isStale ? 'Signal Stale' : locationSource === 'gps' ? 'GPS Active (Satellite)' : 'Network Location';
      case 'low_accuracy':
        return 'Network / Coarse Fix';
      case 'waiting_for_fix':
        return 'Acquiring Location...';
      case 'requesting':
        return 'Requesting Permission...';
      case 'denied':
        return 'Permission Denied';
      case 'unavailable':
        return 'Location Unavailable';
      case 'timeout':
        return 'GPS Re-acquiring...';
      case 'ip_fallback':
        return 'Approximate City / IP';
      case 'manual':
        return 'Manual Location';
      case 'unsupported':
        return 'Geolocation Unsupported';
      default:
        return 'Location Ready';
    }
  })();

  return {
    coords,
    accuracy,
    altitude,
    speed,
    heading,
    timestamp,
    isStale,
    status,
    statusLabel,
    errorMessage,
    locationSource,
    locationLabel,
    isTracking,
    trackingMode,
    showExplanationModal,
    requestPermission,
    confirmRequestPermission,
    dismissExplanationModal,
    startTracking,
    stopTracking,
    setDemoMode,
    refreshLocation,
    setManualLocation,
    retryGps
  };
}
