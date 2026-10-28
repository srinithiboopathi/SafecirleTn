import React, { useState, useEffect, useRef } from 'react';
import { MapComponent, calculateBearing } from '../components/MapComponent';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput';
import { api } from '../services/api';
import { RouteOption, Incident, EmergencyFacility, EmergencyContact } from '../types';
import {
  isCoordinateInTamilNadu,
  resolveTamilNaduDistrict,
  TAMIL_NADU_DISTRICTS,
  searchLocalTamilNaduPlaces
} from '../utils/tamilNaduGeo';
import {
  speakInVoice,
  stopAllVoicePlayback,
  buildTamilRouteAnnouncement,
  SUPPORTED_VOICE_LANGUAGES,
  SupportedVoiceLang
} from '../utils/tamilVoice';
import {
  Navigation,
  Clock,
  AlertTriangle,
  Share2,
  Bookmark,
  Footprints,
  Bike,
  Car,
  UserPlus,
  Trash2,
  MessageCircle,
  CheckCircle2,
  X,
  Radio,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  ArrowUpDown,
  Gauge,
  Volume2
} from 'lucide-react';

const getDistanceMeters = (a: [number, number], b: [number, number]): number => {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const RoutePlannerPage: React.FC<{ userLocation: [number, number] }> = ({
  userLocation
}) => {
  const defaultMapCenter: [number, number] = isCoordinateInTamilNadu(
    userLocation[0],
    userLocation[1]
  )
    ? userLocation
    : [11.0168, 76.9558];

  const [mapViewCenter, setMapViewCenter] = useState<[number, number]>(defaultMapCenter);
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [pinSelectionMode, setPinSelectionMode] = useState<'start' | 'end'>('start');

  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [travelMode, setTravelMode] = useState<'foot' | 'bike' | 'car'>('car');
  const [routeVoiceLang, setRouteVoiceLang] = useState<SupportedVoiceLang>('ta');
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);

  // Contacts & Live Trip Sharing
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  // Real-Time Hardware GPS Tracking
  const [isRealGpsTracking, setIsRealGpsTracking] = useState(false);
  const [gpsSpeedKmh, setGpsSpeedKmh] = useState<number>(0);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [remainingDistMeters, setRemainingDistMeters] = useState<number | null>(null);
  const [hasArrived, setHasArrived] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);

  const [isLiveTripActive, setIsLiveTripActive] = useState(false);
  const [livePosition, setLivePosition] = useState<[number, number]>(defaultMapCenter);
  const [liveAddress, setLiveAddress] = useState<string>('Tamil Nadu, India');
  const [activeGuardian, setActiveGuardian] = useState<EmergencyContact | null>(null);

  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsFixRef = useRef<{ coords: [number, number]; timestamp: number } | null>(null);
  const lastRerouteTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  // Route Preview Animation
  const [isGMapNavigating, setIsGMapNavigating] = useState(false);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [navigationPosition, setNavigationPosition] = useState<[number, number] | null>(null);
  const [navigationBearing, setNavigationBearing] = useState<number>(0);
  const navIntervalRef = useRef<any>(null);

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const selectedRouteRef = useRef<RouteOption | undefined>(selectedRoute);
  selectedRouteRef.current = selectedRoute;
  const endCoordsRef = useRef<[number, number] | null>(endCoords);
  endCoordsRef.current = endCoords;
  const travelModeRef = useRef<'foot' | 'bike' | 'car'>(travelMode);
  travelModeRef.current = travelMode;

  useEffect(() => {
    api
      .getIncidents(defaultMapCenter[0], defaultMapCenter[1], 8000, false)
      .then(setIncidents)
      .catch(() => {});
    api
      .getFacilities(defaultMapCenter[0], defaultMapCenter[1])
      .then(setFacilities)
      .catch(() => {});
    api.getSavedRoutes().then(setSavedRoutes).catch(() => {});
    api
      .getUserProfile()
      .then(profile => {
        if (profile && profile.emergencyContacts) {
          setContacts(profile.emergencyContacts);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      stopAllVoicePlayback();
      if (gpsWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (navIntervalRef.current) clearInterval(navIntervalRef.current);
    };
  }, []);

  const handleAnalyzeRoutes = async (
    sCoords: [number, number] | null = startCoords,
    eCoords: [number, number] | null = endCoords,
    mode = travelMode
  ) => {
    setRegionError(null);
    if (!sCoords || !eCoords) {
      setRoutes([]);
      return;
    }

    if (
      !isCoordinateInTamilNadu(sCoords[0], sCoords[1]) ||
      !isCoordinateInTamilNadu(eCoords[0], eCoords[1])
    ) {
      setRegionError('Please select locations within Tamil Nadu.');
      setRoutes([]);
      return;
    }

    setLoading(true);
    try {
      const data = await api.analyzeRoutes(
        { lat: sCoords[0], lng: sCoords[1] },
        { lat: eCoords[0], lng: eCoords[1] },
        mode
      );
      if (data.outOfBounds || data.error) {
        setRegionError(data.error || 'Selected point is outside Tamil Nadu.');
        setRoutes([]);
      } else if (data.routes && data.routes.length > 0) {
        setRoutes(data.routes);
        setSelectedRouteId(data.recommendedRouteId || data.routes[0].id);
        setHasArrived(false);
        api.getFacilities(sCoords[0], sCoords[1]).then(setFacilities).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to analyze routes', e);
    } finally {
      setLoading(false);
    }
  };

  const startRealGpsTravel = () => {
    if (!navigator.geolocation) {
      setGpsStatusMessage('Geolocation is not supported on this browser.');
      return;
    }

    setIsGMapNavigating(false);
    setHasArrived(false);
    setIsRealGpsTracking(true);
    setGpsStatusMessage('Connecting to GPS...');

    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
    }

    const id = navigator.geolocation.watchPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const newPos: [number, number] = [lat, lng];
        const now = Date.now();

        setGpsAccuracyMeters(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null);

        let computedSpeedKmh = 0;
        if (
          typeof pos.coords.speed === 'number' &&
          !Number.isNaN(pos.coords.speed) &&
          pos.coords.speed >= 0
        ) {
          computedSpeedKmh = pos.coords.speed * 3.6;
        } else if (lastGpsFixRef.current) {
          const dtSec = (now - lastGpsFixRef.current.timestamp) / 1000;
          const movedMeters = getDistanceMeters(lastGpsFixRef.current.coords, newPos);
          if (dtSec > 0.5 && movedMeters > 1.5) {
            computedSpeedKmh = (movedMeters / dtSec) * 3.6;
          }
        }
        setGpsSpeedKmh(Math.min(180, Math.round(computedSpeedKmh * 10) / 10));

        if (
          typeof pos.coords.heading === 'number' &&
          !Number.isNaN(pos.coords.heading) &&
          pos.coords.heading >= 0
        ) {
          setNavigationBearing(pos.coords.heading);
        } else if (lastGpsFixRef.current) {
          const movedMeters = getDistanceMeters(lastGpsFixRef.current.coords, newPos);
          if (movedMeters >= 2) {
            setNavigationBearing(calculateBearing(lastGpsFixRef.current.coords, newPos));
          }
        }

        lastGpsFixRef.current = { coords: newPos, timestamp: now };
        setLivePosition(newPos);
        setNavigationPosition(newPos);
        setMapViewCenter(newPos);
        setGpsStatusMessage(null);

        const activeRt = selectedRouteRef.current;
        const dest = endCoordsRef.current;

        if (dest) {
          const distToDest = getDistanceMeters(newPos, dest);
          setRemainingDistMeters(Math.round(distToDest));

          if (distToDest <= 50) {
            setHasArrived(true);
          }
        }

        if (activeRt && activeRt.coordinates.length >= 2) {
          let closestIdx = 0;
          let minMeters = Infinity;
          activeRt.coordinates.forEach((pt, idx) => {
            const d = getDistanceMeters(pt, newPos);
            if (d < minMeters) {
              minMeters = d;
              closestIdx = idx;
            }
          });
          setNavStepIndex(closestIdx);

          if (
            minMeters > 150 &&
            dest &&
            isCoordinateInTamilNadu(lat, lng) &&
            isCoordinateInTamilNadu(dest[0], dest[1]) &&
            now - lastRerouteTimeRef.current > 15000
          ) {
            lastRerouteTimeRef.current = now;
            setGpsStatusMessage('Rerouting from your live GPS...');
            setStartCoords(newPos);
            handleAnalyzeRoutes(newPos, dest, travelModeRef.current);
          }
        }

        try {
          const geo = await api.reverseGeocode(lat, lng);
          if (geo && geo.address) {
            setLiveAddress(geo.address);
          }
        } catch {
          // Ignore
        }
      },
      err => {
        setGpsStatusMessage(err.message || 'Allow location access for live GPS tracking.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );

    gpsWatchIdRef.current = id;
  };

  const stopRealGpsTravel = () => {
    setIsRealGpsTracking(false);
    setGpsSpeedKmh(0);
    setGpsStatusMessage(null);
    if (gpsWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
  };

  const updateStartMarker = async (lat: number, lng: number, customLabel?: string) => {
    if (!isCoordinateInTamilNadu(lat, lng)) {
      setRegionError('Please select a Start point inside Tamil Nadu.');
      return;
    }
    setRegionError(null);
    const newStart: [number, number] = [lat, lng];
    setStartCoords(newStart);
    setNavigationPosition(newStart);
    setLivePosition(newStart);
    setMapViewCenter(newStart);

    if (endCoords) {
      setNavigationBearing(calculateBearing(newStart, endCoords));
      setRemainingDistMeters(Math.round(getDistanceMeters(newStart, endCoords)));
    } else {
      setPinSelectionMode('end');
    }

    if (customLabel) {
      setStartQuery(customLabel);
      setLiveAddress(customLabel);
    } else {
      setStartQuery(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
      api
        .reverseGeocode(lat, lng)
        .then(geo => {
          if (geo?.address) {
            const shortAddr = geo.address.split(',').slice(0, 2).join(',').trim();
            setStartQuery(shortAddr);
            setLiveAddress(geo.address);
          }
        })
        .catch(() => {});
    }

    if (endCoords) {
      await handleAnalyzeRoutes(newStart, endCoords, travelMode);
    }
  };

  const updateDestinationMarker = async (lat: number, lng: number, customLabel?: string) => {
    if (!isCoordinateInTamilNadu(lat, lng)) {
      setRegionError('Please select a Destination inside Tamil Nadu.');
      return;
    }
    setRegionError(null);
    const newEnd: [number, number] = [lat, lng];
    setEndCoords(newEnd);
    setMapViewCenter(newEnd);

    if (startCoords) {
      setNavigationBearing(calculateBearing(startCoords, newEnd));
      setRemainingDistMeters(Math.round(getDistanceMeters(startCoords, newEnd)));
    }

    if (customLabel) {
      setEndQuery(customLabel);
    } else {
      setEndQuery(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
      api
        .reverseGeocode(lat, lng)
        .then(geo => {
          if (geo?.address) {
            const shortAddr = geo.address.split(',').slice(0, 2).join(',').trim();
            setEndQuery(shortAddr);
          }
        })
        .catch(() => {});
    }

    if (startCoords) {
      await handleAnalyzeRoutes(startCoords, newEnd, travelMode);
    }
  };

  const handleClearLocations = () => {
    stopRealGpsTravel();
    setStartCoords(null);
    setEndCoords(null);
    setStartQuery('');
    setEndQuery('');
    setRoutes([]);
    setSelectedRouteId('');
    setNavigationPosition(null);
    setRemainingDistMeters(null);
    setHasArrived(false);
    setIsGMapNavigating(false);
    setRegionError(null);
    setPinSelectionMode('start');
  };

  const applyYourLocation = async (lat: number, lng: number) => {
    const validCoords: [number, number] = isCoordinateInTamilNadu(lat, lng)
      ? [lat, lng]
      : defaultMapCenter;
    setLocatingOrigin(false);
    const dist = resolveTamilNaduDistrict(validCoords[0], validCoords[1]);
    await updateStartMarker(validCoords[0], validCoords[1], `Current GPS (${dist.name})`);
  };

  const handleUseYourLocation = () => {
    setLocatingOrigin(true);
    setRegionError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => applyYourLocation(pos.coords.latitude, pos.coords.longitude),
        () => applyYourLocation(defaultMapCenter[0], defaultMapCenter[1]),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      applyYourLocation(defaultMapCenter[0], defaultMapCenter[1]);
    }
  };

  const handleSwapMarkers = () => {
    if (!startCoords && !endCoords) return;
    const prevStart = startCoords;
    const prevEnd = endCoords;
    const prevStartLabel = startQuery;
    const prevEndLabel = endQuery;
    setStartCoords(prevEnd);
    setEndCoords(prevStart);
    setStartQuery(prevEndLabel);
    setEndQuery(prevStartLabel);
    if (prevEnd && prevStart) {
      handleAnalyzeRoutes(prevEnd, prevStart, travelMode);
    }
  };

  const resolveTypedPlace = async (queryText: string): Promise<[number, number] | null> => {
    const q = queryText.trim();
    if (!q) return null;
    const local = searchLocalTamilNaduPlaces(q, 1);
    if (local.length > 0) {
      return [local[0].lat, local[0].lng];
    }
    const remote = await api.searchLocation(q);
    if (Array.isArray(remote) && remote.length > 0) {
      return [Number(remote[0].lat), Number(remote[0].lng)];
    }
    return null;
  };

  const handleSearchAndRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegionError(null);

    if (!startQuery.trim() && !startCoords) {
      setRegionError('Select or type a Start location (A).');
      return;
    }
    if (!endQuery.trim() && !endCoords) {
      setRegionError('Select or type a Destination (B).');
      return;
    }

    setLoading(true);
    try {
      let sCoords = startCoords;
      if (!sCoords && startQuery.trim()) {
        const resolvedS = await resolveTypedPlace(startQuery);
        if (resolvedS) {
          sCoords = resolvedS;
          setStartCoords(sCoords);
          setNavigationPosition(sCoords);
        } else {
          setRegionError(`Could not find "${startQuery}" in Tamil Nadu.`);
          setLoading(false);
          return;
        }
      }

      let eCoords = endCoords;
      if (!eCoords && endQuery.trim()) {
        const resolvedE = await resolveTypedPlace(endQuery);
        if (resolvedE) {
          eCoords = resolvedE;
          setEndCoords(eCoords);
        } else {
          setRegionError(`Could not find "${endQuery}" in Tamil Nadu.`);
          setLoading(false);
          return;
        }
      }

      if (sCoords && eCoords) {
        await handleAnalyzeRoutes(sCoords, eCoords, travelMode);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: 'foot' | 'bike' | 'car') => {
    setTravelMode(newMode);
    if (startCoords && endCoords) {
      handleAnalyzeRoutes(startCoords, endCoords, newMode);
    }
  };

  const formatDistance = (meters: number) => {
    if (!meters || meters <= 0) return '0.0 km';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '1 min';
    const totalMins = Math.max(1, Math.round(seconds / 60));
    if (totalMins < 60) return `${totalMins} min`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    setAddingContact(true);
    try {
      const res = await api.addEmergencyContact({
        name: newContactName,
        phone: newContactPhone,
        relation: newContactRelation || 'Trusted Contact'
      });
      if (res.contacts) {
        setContacts(res.contacts);
        setNewContactName('');
        setNewContactPhone('');
        setNewContactRelation('');
      }
    } catch (err) {
      console.error('Failed to save contact', err);
    } finally {
      setAddingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const res = await api.deleteEmergencyContact(id);
      if (res.contacts) setContacts(res.contacts);
    } catch (err) {
      console.error('Failed to delete contact', err);
    }
  };

  useEffect(() => {
    if (isRealGpsTracking) return;
    if (selectedRoute && selectedRoute.coordinates.length >= 2) {
      const coords = selectedRoute.coordinates;
      setNavStepIndex(0);
      setNavigationPosition(coords[0]);
      setLivePosition(coords[0]);
      setRemainingDistMeters(Math.round(selectedRoute.distance));
      const nextPt =
        coords.find(
          pt =>
            Math.abs(pt[0] - coords[0][0]) > 0.00003 ||
            Math.abs(pt[1] - coords[0][1]) > 0.00003
        ) || coords[1];
      setNavigationBearing(calculateBearing(coords[0], nextPt));
    } else if (startCoords && endCoords) {
      setNavigationPosition(startCoords);
      setNavigationBearing(calculateBearing(startCoords, endCoords));
    } else if (startCoords) {
      setNavigationPosition(startCoords);
    } else {
      setNavigationPosition(null);
    }
  }, [selectedRouteId, routes, startCoords, endCoords, isRealGpsTracking]);

  useEffect(() => {
    if (!isGMapNavigating || !selectedRoute || selectedRoute.coordinates.length < 2) {
      if (navIntervalRef.current) {
        clearInterval(navIntervalRef.current);
        navIntervalRef.current = null;
      }
      return;
    }

    const coords = selectedRoute.coordinates;
    navIntervalRef.current = setInterval(() => {
      setNavStepIndex(prev => {
        const nextIdx = prev + 1;
        if (nextIdx >= coords.length) {
          setIsGMapNavigating(false);
          setHasArrived(true);
          setRemainingDistMeters(0);
          return coords.length - 1;
        }
        const currPt = coords[prev];
        const nextPt = coords[nextIdx];
        if (
          Math.abs(nextPt[0] - currPt[0]) > 0.00001 ||
          Math.abs(nextPt[1] - currPt[1]) > 0.00001
        ) {
          setNavigationBearing(calculateBearing(currPt, nextPt));
        }
        setNavigationPosition(nextPt);
        setLivePosition(nextPt);
        if (endCoordsRef.current) {
          setRemainingDistMeters(Math.round(getDistanceMeters(nextPt, endCoordsRef.current)));
        }
        return nextIdx;
      });
    }, 500);

    return () => {
      if (navIntervalRef.current) {
        clearInterval(navIntervalRef.current);
        navIntervalRef.current = null;
      }
    };
  }, [isGMapNavigating, selectedRoute]);

  const handleScrubRouteProgress = (newIndex: number) => {
    if (!selectedRoute || selectedRoute.coordinates.length < 2) return;
    const coords = selectedRoute.coordinates;
    const clamped = Math.max(0, Math.min(coords.length - 1, newIndex));
    setNavStepIndex(clamped);
    setNavigationPosition(coords[clamped]);
    setLivePosition(coords[clamped]);
    if (endCoords) {
      setRemainingDistMeters(Math.round(getDistanceMeters(coords[clamped], endCoords)));
    }
    if (clamped < coords.length - 1) {
      setNavigationBearing(calculateBearing(coords[clamped], coords[clamped + 1]));
    } else if (clamped > 0) {
      setNavigationBearing(calculateBearing(coords[clamped - 1], coords[clamped]));
    }
  };

  const buildWhatsAppUrl = (
    contact: EmergencyContact,
    pos: [number, number],
    statusType: 'start' | 'update' | 'arrived' = 'start'
  ) => {
    let digits = contact.phone.replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    const modeLabel =
      travelMode === 'foot' ? 'Walking' : travelMode === 'bike' ? 'Bike' : 'Driving';
    const distText = selectedRoute ? formatDistance(selectedRoute.distance) : '';
    const timeText = selectedRoute ? formatDuration(selectedRoute.duration) : '';
    const safetyText = selectedRoute ? `${selectedRoute.safetyScore}/100` : '88/100';
    const district = resolveTamilNaduDistrict(pos[0], pos[1]);
    const currentGMapLink = `https://www.google.com/maps?q=${pos[0]},${pos[1]}`;

    let header = `🛡️ *SafeCircle AI — Live Trip Started*`;
    if (statusType === 'update') header = `📍 *SafeCircle AI — Live Location Update*`;
    if (statusType === 'arrived') header = `✅ *SafeCircle AI — Arrived Safely*`;

    const message =
      `${header}\n` +
      `• *District:* ${district.name}\n` +
      `• *Current:* ${liveAddress}\n` +
      `• *Destination:* ${endQuery || 'Destination'}\n` +
      `• *Mode:* ${modeLabel} (${distText}, ${timeText})\n` +
      `• *Safety Score:* ${safetyText}\n` +
      `📌 *Map:* ${currentGMapLink}`;

    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  const startLiveTripWithGuardian = (contact: EmergencyContact) => {
    setActiveGuardian(contact);
    setIsLiveTripActive(true);
    setShowShareModal(false);
    startRealGpsTravel();
  };

  const stopLiveTrip = () => {
    setIsLiveTripActive(false);
    stopRealGpsTravel();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent text-[#FAFAFA] p-3 sm:p-5 flex flex-col">
      <div className="max-w-[1440px] mx-auto w-full flex-1 flex flex-col gap-4">
        {/* Live Hardware GPS Status Bar */}
        {isRealGpsTracking && (
          <div className="luxury-card border border-[#22C55E] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#22C55E]/20 border border-[#22C55E] flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-[#22C55E] animate-ping" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#22C55E]">LIVE GPS ACTIVE</span>
                  <span className="text-xs bg-[#111114] text-[#FAFAFA] px-2 py-0.5 rounded font-mono border border-[#303036] flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-[#FFD43B]" /> {gpsSpeedKmh} km/h
                  </span>
                  {gpsAccuracyMeters !== null && (
                    <span className="text-[11px] bg-[#111114] text-[#A1A1AA] px-2 py-0.5 rounded font-mono border border-[#303036]">
                      ±{gpsAccuracyMeters}m
                    </span>
                  )}
                  {remainingDistMeters !== null && (
                    <span className="text-[11px] bg-[#22C55E]/15 text-[#22C55E] px-2 py-0.5 rounded font-mono font-bold">
                      {formatDistance(remainingDistMeters)} left
                    </span>
                  )}
                </div>
                {gpsStatusMessage && (
                  <div className="text-[11px] text-[#FFD43B] mt-0.5">{gpsStatusMessage}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeGuardian && (
                <>
                  <a
                    href={buildWhatsAppUrl(activeGuardian, livePosition, 'update')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#22C55E] text-[#09090B] text-xs font-bold flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Update
                  </a>
                  <a
                    href={buildWhatsAppUrl(activeGuardian, livePosition, 'arrived')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => stopLiveTrip()}
                    className="px-3 py-1.5 rounded-lg bg-[#168BFF] text-white text-xs font-bold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Arrived
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  stopRealGpsTravel();
                  if (isLiveTripActive) stopLiveTrip();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#111114] hover:bg-red-950/60 text-xs font-semibold border border-[#303036] cursor-pointer"
              >
                Stop GPS
              </button>
            </div>
          </div>
        )}

        {hasArrived && (
          <div className="p-3 rounded-xl bg-[#22C55E]/15 border border-[#22C55E] text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              Arrived at {endQuery || 'Destination'}!
            </span>
            <button onClick={() => setHasArrived(false)} className="text-[#A1A1AA] hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {regionError && (
          <div className="p-3 rounded-xl bg-[#18181B] border border-[#EF4444]/60 text-xs flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[#FF334F] font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {regionError}
            </span>
            <button onClick={() => setRegionError(null)} className="text-[#A1A1AA] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row gap-5">
          {/* Left Navigation Panel (Clean Google Maps Style) */}
          <div className="w-full lg:w-[410px] flex flex-col gap-4 shrink-0">
            <div className="luxury-card p-4 sm:p-5 space-y-4">
              {/* Top Bar: Title + District Quick Jump + Reset */}
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#168BFF]" />
                  <span>Route Planner</span>
                </h1>

                <div className="flex items-center gap-1.5">
                  <select
                    onChange={e => {
                      const d = TAMIL_NADU_DISTRICTS.find(item => item.id === e.target.value);
                      if (d) setMapViewCenter([d.lat, d.lng]);
                    }}
                    defaultValue="coimbatore"
                    className="bg-[#111114] border border-[#303036] rounded-lg px-2 py-1 text-[11px] text-[#FAFAFA] focus:outline-none"
                    title="Jump to District"
                  >
                    {TAMIL_NADU_DISTRICTS.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  {(startCoords || endCoords) && (
                    <button
                      type="button"
                      onClick={handleClearLocations}
                      className="p-1.5 rounded-lg bg-[#111114] hover:bg-[#18181B] border border-[#303036] text-[#A1A1AA] hover:text-white cursor-pointer"
                      title="Reset Pins"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Walk / Bike / Car Mode Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#111114] rounded-xl border border-[#303036]">
                {[
                  { id: 'car', label: 'Drive', icon: Car },
                  { id: 'bike', label: 'Bike', icon: Bike },
                  { id: 'foot', label: 'Walk', icon: Footprints }
                ].map(m => {
                  const Icon = m.icon;
                  const active = travelMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModeChange(m.id as 'foot' | 'bike' | 'car')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#E11D48] text-white shadow'
                          : 'text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Google Maps-Style Start (A) & Destination (B) Live Search */}
              <form onSubmit={handleSearchAndRoute} className="space-y-2.5">
                <div className="relative space-y-2">
                  {/* START (A) */}
                  <LocationAutocompleteInput
                    value={startQuery}
                    onChange={setStartQuery}
                    onFocusInput={() => setPinSelectionMode('start')}
                    isActive={pinSelectionMode === 'start'}
                    badgeText="A"
                    badgeColor="#168BFF"
                    placeholder="Choose starting point or click map..."
                    onUseGps={handleUseYourLocation}
                    locatingGps={locatingOrigin}
                    onClear={() => {
                      setStartCoords(null);
                      setRoutes([]);
                    }}
                    onSelect={place => {
                      updateStartMarker(place.lat, place.lng, place.name);
                    }}
                  />

                  {/* Swap Button */}
                  <div className="flex justify-end pr-2 -my-1 relative z-10">
                    <button
                      type="button"
                      onClick={handleSwapMarkers}
                      disabled={!startCoords && !endCoords}
                      className="p-1.5 rounded-full bg-[#18181B] hover:bg-[#168BFF] disabled:opacity-40 text-white border border-white/15 shadow cursor-pointer transition-colors"
                      title="Swap Start & Destination"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* DESTINATION (B) */}
                  <LocationAutocompleteInput
                    value={endQuery}
                    onChange={setEndQuery}
                    onFocusInput={() => setPinSelectionMode('end')}
                    isActive={pinSelectionMode === 'end'}
                    badgeText="B"
                    badgeColor="#22C55E"
                    placeholder="Choose destination or click map..."
                    onClear={() => {
                      setEndCoords(null);
                      setRoutes([]);
                    }}
                    onSelect={place => {
                      updateDestinationMarker(place.lat, place.lng, place.name);
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#E11D48] hover:bg-[#FF334F] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{loading ? 'Finding Safe Routes...' : 'Find Safe Routes'}</span>
                </button>
              </form>

              {/* Saved Presets */}
              {savedRoutes.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                  <Bookmark className="w-3.5 h-3.5 text-[#168BFF] shrink-0" />
                  {savedRoutes.map(sr => (
                    <button
                      key={sr.id}
                      type="button"
                      onClick={() => {
                        setStartQuery(sr.start.name);
                        setEndQuery(sr.end.name);
                        setStartCoords([sr.start.lat, sr.start.lng]);
                        setEndCoords([sr.end.lat, sr.end.lng]);
                        handleAnalyzeRoutes(
                          [sr.start.lat, sr.start.lng],
                          [sr.end.lat, sr.end.lng],
                          travelMode
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#111114] hover:bg-[#18181B] border border-[#303036] text-[11px] text-[#FAFAFA] whitespace-nowrap cursor-pointer"
                    >
                      {sr.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Route Options Comparison List */}
            <div className="luxury-card p-4 flex-1 overflow-y-auto space-y-3 max-h-[520px]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span>Route Options</span>
                  {routes.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#168BFF]/20 text-[#168BFF] border border-[#168BFF]/40 text-[10px] font-mono">
                      {routes.length} Available
                    </span>
                  )}
                </h2>

                <select
                  value={routeVoiceLang}
                  onChange={e => setRouteVoiceLang(e.target.value as SupportedVoiceLang)}
                  className="bg-[#111114] border border-[#303036] rounded-lg px-2 py-1 text-[11px] text-[#FFD43B] font-bold focus:outline-none"
                  title="Select Route Voice Language"
                >
                  {SUPPORTED_VOICE_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      🔊 {l.nativeLabel} ({l.englishLabel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Option Switcher Tabs (Option 1 / Option 2 / Option 3) */}
              {routes.length > 1 && (
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#111114] rounded-xl border border-[#303036]">
                  {routes.map((rt, idx) => {
                    const active = rt.id === selectedRouteId;
                    const tag = idx === 0 ? 'Safest' : idx === 1 ? 'Fastest' : 'Bypass';
                    return (
                      <button
                        key={rt.id}
                        type="button"
                        onClick={() => setSelectedRouteId(rt.id)}
                        className={`py-1.5 px-2 rounded-lg text-left transition-all cursor-pointer border ${
                          active
                            ? 'bg-[#168BFF]/20 border-[#168BFF] text-white shadow'
                            : 'bg-transparent border-transparent text-[#A1A1AA] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                          <span>Option {idx + 1}</span>
                          <span className="text-[#22C55E]">{rt.safetyScore}%</span>
                        </div>
                        <div className="text-[10px] text-[#FFD43B] truncate mt-0.5">
                          {tag} • {formatDuration(rt.duration)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {routes.length === 0 && !loading && (
                <div className="p-6 rounded-xl bg-[#111114] border border-[#303036] text-center space-y-1.5">
                  <MapPin className="w-5 h-5 text-[#168BFF] mx-auto" />
                  <div className="text-xs font-semibold text-white">Select Start & Destination</div>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Type any place above or tap directly on the map to compare 3 route options.
                  </p>
                </div>
              )}

              {routes.map((route, idx) => {
                const isSelected = route.id === selectedRouteId;
                const optionBadgeText =
                  idx === 0
                    ? 'Option 1 • Safest Corridor'
                    : idx === 1
                    ? 'Option 2 • Fastest Direct'
                    : `Option ${idx + 1} • Alternate Bypass`;
                const optionBadgeStyle =
                  idx === 0
                    ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40'
                    : idx === 1
                    ? 'bg-[#FFD43B]/15 text-[#FFD43B] border-[#FFD43B]/40'
                    : 'bg-[#A855F7]/15 text-[#C084FC] border-[#A855F7]/40';
                const routeRiskColor =
                  route.riskLevel === 'HIGH' || route.riskLevel === 'CRITICAL'
                    ? 'text-[#EF4444]'
                    : route.riskLevel === 'MODERATE'
                    ? 'text-[#F59E0B]'
                    : 'text-[#22C55E]';

                return (
                  <div
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-[#18181B] border-[#168BFF] shadow-lg ring-1 ring-[#168BFF]/50'
                        : 'bg-[#111114] border-[#303036] hover:border-white/30'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-bold ${optionBadgeStyle}`}
                          >
                            {optionBadgeText}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#168BFF] text-white font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-white truncate">{route.name}</h3>
                        {route.classificationLabel && (
                          <div className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
                            {route.classificationLabel}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-[#FAFAFA] font-mono mt-1.5">
                          <span className="flex items-center gap-1 font-bold text-[#FFD43B]">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(route.duration)}
                          </span>
                          <span className="text-[#A1A1AA]">•</span>
                          <span>{formatDistance(route.distance)}</span>
                        </div>
                        {route.traffic && (
                          <div className="mt-2 space-y-1">
                            <div className="inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#111114] border border-[#303036] text-[10px] font-mono">
                              <span
                                className={`font-bold ${
                                  route.traffic.congestionLevel === 'HIGH' ||
                                  route.traffic.congestionLevel === 'SEVERE'
                                    ? 'text-[#EF4444]'
                                    : route.traffic.congestionLevel === 'MODERATE'
                                    ? 'text-[#FFD43B]'
                                    : 'text-[#22C55E]'
                                }`}
                              >
                                🚦 {route.traffic.congestionLevel} TRAFFIC (
                                {route.traffic.congestionPercentage}%)
                              </span>
                              <span className="text-[#A1A1AA]">•</span>
                              <span className="text-white">{route.traffic.averageSpeedKmh} km/h</span>
                              <span className="text-[#A1A1AA]">•</span>
                              <span className="text-[#FFD43B]">+{route.traffic.delayMinutes}m delay</span>
                            </div>
                            <div className="text-[10px] text-[#A1A1AA] truncate">
                              {route.traffic.corridorSummary}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-lg font-black font-mono ${routeRiskColor}`}>
                          {route.safetyScore}%
                        </div>
                        <div className="text-[10px] text-[#A1A1AA]">Safety</div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="pt-2 border-t border-[#303036] space-y-2">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (isRealGpsTracking) {
                              stopRealGpsTravel();
                              stopAllVoicePlayback();
                            } else {
                              startRealGpsTravel();
                              speakInVoice(
                                buildTamilRouteAnnouncement({
                                  routeName: route.name,
                                  optionNumber: idx + 1,
                                  safetyScore: route.safetyScore,
                                  durationSeconds: route.duration,
                                  distanceMeters: route.distance,
                                  destination: endQuery.split(',')[0],
                                  lang: routeVoiceLang
                                }),
                                routeVoiceLang
                              );
                            }
                          }}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isRealGpsTracking
                              ? 'bg-[#22C55E] text-[#09090B]'
                              : 'bg-[#22C55E] hover:bg-[#16A34A] text-[#09090B]'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>
                            {isRealGpsTracking
                              ? `Stop Live GPS (${gpsSpeedKmh} km/h)`
                              : 'Start Live GPS + Voice'}
                          </span>
                        </button>

                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              speakInVoice(
                                buildTamilRouteAnnouncement({
                                  routeName: route.name,
                                  optionNumber: idx + 1,
                                  safetyScore: route.safetyScore,
                                  durationSeconds: route.duration,
                                  distanceMeters: route.distance,
                                  destination: endQuery.split(',')[0],
                                  lang: routeVoiceLang
                                }),
                                routeVoiceLang
                              );
                            }}
                            className="py-1.5 px-2 rounded-lg bg-[#111114] hover:bg-white/10 text-[#FFD43B] border border-[#303036] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            title="Speak route guidance in selected language"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>
                              {
                                SUPPORTED_VOICE_LANGUAGES.find(l => l.code === routeVoiceLang)
                                  ?.nativeLabel
                              }{' '}
                              Voice
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              stopRealGpsTravel();
                              if (
                                selectedRoute &&
                                navStepIndex >= selectedRoute.coordinates.length - 1
                              ) {
                                handleScrubRouteProgress(0);
                              }
                              const nextNav = !isGMapNavigating;
                              setIsGMapNavigating(nextNav);
                              if (nextNav) {
                                speakInVoice(
                                  buildTamilRouteAnnouncement({
                                    routeName: route.name,
                                    optionNumber: idx + 1,
                                    safetyScore: route.safetyScore,
                                    durationSeconds: route.duration,
                                    distanceMeters: route.distance,
                                    destination: endQuery.split(',')[0],
                                    lang: routeVoiceLang
                                  }),
                                  routeVoiceLang
                                );
                              } else {
                                stopAllVoicePlayback();
                              }
                            }}
                            className="py-1.5 px-2 rounded-lg bg-[#111114] hover:bg-white/10 text-white border border-[#303036] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {isGMapNavigating ? (
                              <>
                                <Pause className="w-3.5 h-3.5 text-[#FFD43B]" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 text-[#FFD43B]" />
                                <span>Preview</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setShowShareModal(true);
                            }}
                            className="py-1.5 px-2 rounded-lg bg-[#E11D48] hover:bg-[#FF334F] text-white text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Interactive Map */}
          <div className="flex-1 h-[560px] lg:h-auto relative">
            <MapComponent
              center={
                (isRealGpsTracking || isGMapNavigating || isLiveTripActive) && navigationPosition
                  ? navigationPosition
                  : startCoords || mapViewCenter
              }
              zoom={14}
              routes={routes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={routeId => setSelectedRouteId(routeId)}
              incidents={incidents}
              facilities={facilities}
              travelMode={travelMode}
              startCoords={startCoords}
              endCoords={endCoords}
              startLabel={startQuery || 'Start (A)'}
              endLabel={endQuery || 'Destination (B)'}
              navigationPosition={navigationPosition}
              navigationBearing={navigationBearing}
              pinSelectionMode={pinSelectionMode}
              onPinSelectionModeChange={setPinSelectionMode}
              requireManualEndpoints={true}
              onStartDragEnd={(lat, lng) => updateStartMarker(lat, lng)}
              onEndDragEnd={(lat, lng) => updateDestinationMarker(lat, lng)}
              onMapClick={(lat, lng, mode) => {
                const effectiveMode = !startCoords ? 'start' : mode || pinSelectionMode;
                if (effectiveMode === 'start') {
                  updateStartMarker(lat, lng);
                } else {
                  updateDestinationMarker(lat, lng);
                }
              }}
            />

            {/* Compact Floating Active Route HUD + Map Option Switcher */}
            {selectedRoute && (
              <div className="absolute top-3 left-3 z-[400] bg-[#11131A]/95 backdrop-blur-md p-3 rounded-xl border border-white/15 shadow-2xl w-72 space-y-2">
                {routes.length > 1 && (
                  <div className="flex items-center gap-1 pb-1.5 border-b border-white/10">
                    {routes.map((rt, idx) => {
                      const active = rt.id === selectedRouteId;
                      return (
                        <button
                          key={rt.id}
                          type="button"
                          onClick={() => setSelectedRouteId(rt.id)}
                          className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#168BFF] text-white'
                              : 'bg-[#18181B] text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          Opt {idx + 1} ({rt.safetyScore}%)
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                    <Navigation
                      className="w-3.5 h-3.5 text-[#168BFF] shrink-0"
                      style={{ transform: `rotate(${navigationBearing}deg)` }}
                    />
                    <span className="truncate">{selectedRoute.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#22C55E] shrink-0">
                    {selectedRoute.safetyScore}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] font-mono">
                  <span>
                    {remainingDistMeters !== null
                      ? `${formatDistance(remainingDistMeters)} left`
                      : formatDistance(selectedRoute.distance)}{' '}
                    • {formatDuration(selectedRoute.duration)}
                  </span>
                  <span>{Math.round(navigationBearing)}°</span>
                </div>

                {selectedRoute.coordinates.length >= 2 && (
                  <input
                    type="range"
                    min={0}
                    max={selectedRoute.coordinates.length - 1}
                    value={navStepIndex}
                    onChange={e => {
                      stopRealGpsTravel();
                      setIsGMapNavigating(false);
                      handleScrubRouteProgress(Number(e.target.value));
                    }}
                    className="w-full accent-[#168BFF] h-1 bg-[#18181B] rounded-lg cursor-pointer"
                    title="Scrub route progress"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Live Location Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="luxury-card max-w-md w-full p-5 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#111114] border border-[#303036] text-[#A1A1AA] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/40 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Share Live Trip</h2>
                <p className="text-xs text-[#A1A1AA]">Send live GPS link via WhatsApp</p>
              </div>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {contacts.map(c => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-[#111114] border border-[#303036] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-bold text-white">{c.name}</div>
                    <div className="text-[11px] text-[#A1A1AA] font-mono">{c.phone}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={buildWhatsAppUrl(c, startCoords || defaultMapCenter, 'start')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => startLiveTripWithGuardian(c)}
                      className="px-3 py-1.5 rounded-lg bg-[#22C55E] text-[#09090B] text-xs font-bold flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Share
                    </a>
                    <button
                      onClick={() => handleDeleteContact(c.id)}
                      className="p-1.5 rounded-lg bg-[#18181B] text-[#A1A1AA] hover:text-[#EF4444]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddContact} className="pt-3 border-t border-[#303036] space-y-2">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-[#168BFF]" /> Add Contact
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  placeholder="Name"
                  required
                  className="bg-[#111114] border border-[#303036] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={newContactRelation}
                  onChange={e => setNewContactRelation(e.target.value)}
                  placeholder="Relation"
                  className="bg-[#111114] border border-[#303036] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={newContactPhone}
                  onChange={e => setNewContactPhone(e.target.value)}
                  placeholder="Phone (+91...)"
                  required
                  className="flex-1 bg-[#111114] border border-[#303036] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={addingContact}
                  className="px-3.5 py-1.5 rounded-lg bg-[#E11D48] text-white font-bold text-xs cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
