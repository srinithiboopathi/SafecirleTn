import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Navigation,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Shield,
  X,
  Compass,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  PhoneCall,
  ChevronDown,
  ChevronUp,
  List,
  LocateFixed,
  Sparkles,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Footprints,
  Bike,
  Car,
  MessageCircle
} from 'lucide-react';
import { RouteGeometryItem, RouteAnalysisResult, EmergencyFacility, SafetyIncident, TravelMode, JourneySession } from '../types';
import {
  computeBearing,
  computeHaversineMeters,
  computeModeDurationSeconds,
  findNearestPointOnPolyline,
  formatAccuracy,
  formatDistance,
  formatSpeedKmh
} from '../utils/geoUtils';
import {
  buildTelUrl,
  buildWhatsAppSafePingUrl,
  buildWhatsAppArrivalUrl,
  getLocalSavedContacts,
  getDefaultWhatsAppContactId,
  getSavedTravelerName,
  initiateImmediatePhoneCall
} from '../utils/whatsappUtils';

export interface LiveTripTelemetry {
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  progressPercent: number;
  remainingMeters: number;
  remainingSeconds: number;
  arrived: boolean;
}

interface GoogleMapsNavigationSimulatorProps {
  route: RouteGeometryItem;
  analysis?: RouteAnalysisResult;
  startAddress: string;
  destAddress: string;
  destCoords?: [number, number];
  travelMode?: TravelMode;
  onTravelModeChange?: (mode: TravelMode) => void;
  emergencyFacilities?: EmergencyFacility[];
  incidents?: SafetyIncident[];
  onExit: () => void;
  onOpenSos: () => void;
  onSimCoordChange: (coords: [number, number] | null, heading: number) => void;
  isCameraFollowing: boolean;
  onRecenter: () => void;
  // REAL GPS PROPS
  realGpsPoint?: [number, number] | null;
  realGpsAccuracy?: number | null;
  realGpsHeading?: number | null;
  realGpsSpeed?: number | null;
  isGpsStale?: boolean;
  trackingMode?: 'real' | 'demo';
  onToggleTrackingMode?: () => void;
  onRecalculateRoute?: (newOrigin: [number, number]) => Promise<void>;
  // FULL-TRIP LIVE SHARING PROPS
  activeJourneySession?: JourneySession | null;
  onOpenShareModal?: () => void;
  onTelemetryUpdate?: (telemetry: LiveTripTelemetry) => void;
}

export const GoogleMapsNavigationSimulator: React.FC<GoogleMapsNavigationSimulatorProps> = ({
  route,
  analysis,
  startAddress,
  destAddress,
  destCoords,
  travelMode = 'driving',
  onTravelModeChange,
  emergencyFacilities = [],
  incidents = [],
  onExit,
  onOpenSos,
  onSimCoordChange,
  isCameraFollowing,
  onRecenter,
  realGpsPoint = null,
  realGpsAccuracy = null,
  realGpsHeading = null,
  realGpsSpeed = null,
  isGpsStale = false,
  trackingMode = 'real',
  onToggleTrackingMode,
  onRecalculateRoute,
  activeJourneySession = null,
  onOpenShareModal,
  onTelemetryUpdate
}) => {
  // Navigation audio & drawer states
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const [isStepsDrawerOpen, setIsStepsDrawerOpen] = useState<boolean>(false);
  const [silentPingToast, setSilentPingToast] = useState<string | null>(null);
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  // Demo mode simulation states
  const [demoProgress, setDemoProgress] = useState<number>(0);
  const [demoPlaying, setDemoPlaying] = useState<boolean>(true);
  const [demoSpeedMultiplier, setDemoSpeedMultiplier] = useState<number>(1);

  // Off-route sustained trigger detection
  const offRouteCountRef = useRef<number>(0);
  const [showOffRouteAlert, setShowOffRouteAlert] = useState<boolean>(false);

  const lastSpokenStepRef = useRef<number>(-1);
  const coords = route.coordinates; // [[lng, lat], ...]

  // Pre-calculate cumulative distances for polyline
  const cumulativeDistances = useMemo(() => {
    if (!coords || coords.length === 0) return [0];
    const dists = [0];
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const d = computeHaversineMeters(prev[1], prev[0], curr[1], curr[0]);
      dists.push(dists[i - 1] + d);
    }
    return dists;
  }, [coords]);

  const totalDistanceMeters =
    cumulativeDistances[cumulativeDistances.length - 1] || route.distanceMeters || 1000;

  const totalDurationSeconds = useMemo(() => {
    return computeModeDurationSeconds(totalDistanceMeters, travelMode, 0);
  }, [totalDistanceMeters, travelMode]);

  // Turn-by-turn maneuvers formatted from OSRM steps
  const navigationSteps = useMemo(() => {
    if (route.steps && route.steps.length > 0) {
      return route.steps.map((st, i) => {
        let type: 'right' | 'left' | 'slight-right' | 'slight-left' | 'straight' | 'arrive' = 'straight';
        const lower = st.instruction.toLowerCase();
        if (lower.includes('right')) type = 'right';
        else if (lower.includes('left')) type = 'left';
        else if (lower.includes('destination') || lower.includes('arrive') || i === route.steps.length - 1) {
          type = 'arrive';
        }
        return {
          id: i,
          instruction: st.instruction,
          distanceMeters: st.distanceMeters || 100,
          type
        };
      });
    }

    // Fallback synthesized steps along road corridor
    const streetName = destAddress.split(',')[0] || 'Destination Corridor';
    return [
      { id: 0, instruction: `Head toward ${streetName}`, distanceMeters: Math.round(totalDistanceMeters * 0.3), type: 'straight' as const },
      { id: 1, instruction: `Continue along arterial road corridor`, distanceMeters: Math.round(totalDistanceMeters * 0.4), type: 'right' as const },
      { id: 2, instruction: `Turn into destination approach`, distanceMeters: Math.round(totalDistanceMeters * 0.2), type: 'left' as const },
      { id: 3, instruction: `Arrive at ${destAddress.split(',')[0]}`, distanceMeters: Math.round(totalDistanceMeters * 0.1), type: 'arrive' as const }
    ];
  }, [route, totalDistanceMeters, destAddress]);

  // DEMO MODE: Interval loop timer
  useEffect(() => {
    if (trackingMode !== 'demo') return;

    let interval: NodeJS.Timeout;
    if (demoPlaying && !hasArrived) {
      interval = setInterval(() => {
        setDemoProgress((prev) => {
          if (prev >= 100) {
            setDemoPlaying(false);
            setHasArrived(true);
            return 100;
          }
          const stepDeltaPerSec = (100 / totalDurationSeconds) * demoSpeedMultiplier;
          const next = prev + stepDeltaPerSec;
          if (next >= 100) {
            setDemoPlaying(false);
            setHasArrived(true);
            return 100;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [trackingMode, demoPlaying, demoSpeedMultiplier, hasArrived, totalDurationSeconds]);

  // REAL GPS vs DEMO Navigation State Resolution
  const activeNavState = useMemo(() => {
    if (trackingMode === 'real' && realGpsPoint) {
      // 1. REAL GPS MODE: Calculate real cross-track distance and progress along route
      const match = findNearestPointOnPolyline(
        realGpsPoint,
        coords,
        realGpsAccuracy || 20,
        65
      );

      // Check for arrival (within 25 meters of destination)
      const lastCoord = coords[coords.length - 1];
      const distToDest = computeHaversineMeters(realGpsPoint[0], realGpsPoint[1], lastCoord[1], lastCoord[0]);
      const arrived = distToDest <= 25 || match.progressPercentage >= 99;

      // Real-time speed from GPS or mode-calibrated fallback
      const fallbackSpeedMps = travelMode === 'walking' ? 1.333 : travelMode === 'biking' ? 5.56 : 9.44;
      const currentSpeedMps = realGpsSpeed !== null && realGpsSpeed > 0.4 ? realGpsSpeed : fallbackSpeedMps;
      const estRemainingSecs = Math.max(15, Math.round(match.remainingDistanceMeters / currentSpeedMps));

      // Determine active turn maneuver step
      const stepIdx = Math.min(
        navigationSteps.length - 1,
        Math.floor((match.progressPercentage / 100) * navigationSteps.length)
      );

      const activeStep = navigationSteps[stepIdx] || navigationSteps[0];
      const distToTurn = Math.max(15, Math.round(activeStep.distanceMeters * (1 - (match.progressPercentage % 25) / 25)));

      // Heading: prefer device GPS heading, fallback to polyline bearing
      const activeHeading = realGpsHeading !== null ? realGpsHeading : match.bearingAtPoint;

      return {
        lat: realGpsPoint[0],
        lng: realGpsPoint[1],
        heading: activeHeading,
        remainingDistanceMeters: match.remainingDistanceMeters,
        remainingSeconds: estRemainingSecs,
        progressPercentage: match.progressPercentage,
        currentStepIndex: stepIdx,
        distToNextTurn: distToTurn,
        speedKmh: Math.round((realGpsSpeed || 0) * 3.6),
        isOffRoute: match.isOffRoute,
        distanceToRouteMeters: match.distanceToRouteMeters,
        arrived
      };
    }

    // 2. DEMO MODE: Synthesized scrubber along route coordinates
    const currentDist = (demoProgress / 100) * totalDistanceMeters;
    const remainingDist = Math.max(0, totalDistanceMeters - currentDist);
    const remainingSecs = Math.max(0, Math.round((1 - demoProgress / 100) * totalDurationSeconds));

    let targetIdx = 0;
    for (let i = 0; i < cumulativeDistances.length - 1; i++) {
      if (currentDist >= cumulativeDistances[i] && currentDist <= cumulativeDistances[i + 1]) {
        targetIdx = i;
        break;
      }
      if (currentDist > cumulativeDistances[i]) {
        targetIdx = i;
      }
    }

    const p1 = coords[targetIdx] || [76.9558, 11.0168];
    const p2 = coords[Math.min(targetIdx + 1, coords.length - 1)] || p1;

    const segStartDist = cumulativeDistances[targetIdx] || 0;
    const segEndDist = cumulativeDistances[Math.min(targetIdx + 1, cumulativeDistances.length - 1)] || 1;
    const segLen = segEndDist - segStartDist;
    const ratio = segLen > 0 ? (currentDist - segStartDist) / segLen : 0;

    const lat = p1[1] + (p2[1] - p1[1]) * ratio;
    const lng = p1[0] + (p2[0] - p1[0]) * ratio;

    let heading = 0;
    if (targetIdx < coords.length - 1) {
      heading = computeBearing(p1[1], p1[0], p2[1], p2[0]);
    } else if (coords.length > 1) {
      heading = computeBearing(coords[coords.length - 2][1], coords[coords.length - 2][0], coords[coords.length - 1][1], coords[coords.length - 1][0]);
    }

    const stepIdx = Math.min(
      navigationSteps.length - 1,
      Math.floor((demoProgress / 100) * navigationSteps.length)
    );
    const activeStep = navigationSteps[stepIdx];
    const distToTurn = Math.max(20, Math.round((1 - (demoProgress % 25) / 25) * (activeStep?.distanceMeters || 150)));

    const avgSpeed = travelMode === 'walking' ? 5 : travelMode === 'biking' ? 22 : 35;
    const demoSpeed = Math.round(avgSpeed * demoSpeedMultiplier);

    return {
      lat,
      lng,
      heading,
      remainingDistanceMeters: Math.round(remainingDist),
      remainingSeconds: remainingSecs,
      progressPercentage: Math.round(demoProgress),
      currentStepIndex: stepIdx,
      distToNextTurn: distToTurn,
      speedKmh: demoSpeed,
      isOffRoute: false,
      distanceToRouteMeters: 0,
      arrived: demoProgress >= 100
    };
  }, [
    trackingMode,
    realGpsPoint,
    realGpsAccuracy,
    realGpsHeading,
    realGpsSpeed,
    coords,
    navigationSteps,
    demoProgress,
    totalDistanceMeters,
    totalDurationSeconds,
    cumulativeDistances,
    travelMode,
    demoSpeedMultiplier
  ]);

  // Sync arrival state
  useEffect(() => {
    if (activeNavState.arrived && !hasArrived) {
      setHasArrived(true);
    }
  }, [activeNavState.arrived, hasArrived]);

  // Off-route sustained filter (must deviate for at least 3 consecutive updates)
  useEffect(() => {
    if (trackingMode === 'real') {
      if (activeNavState.isOffRoute) {
        offRouteCountRef.current += 1;
        if (offRouteCountRef.current >= 3) {
          setShowOffRouteAlert(true);
        }
      } else {
        offRouteCountRef.current = 0;
        setShowOffRouteAlert(false);
      }
    } else {
      setShowOffRouteAlert(false);
    }
  }, [activeNavState.isOffRoute, trackingMode]);

  // Sync coordinates and full-trip telemetry to parent callbacks
  const onSimCoordChangeRef = useRef(onSimCoordChange);
  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  useEffect(() => {
    onSimCoordChangeRef.current = onSimCoordChange;
    onTelemetryUpdateRef.current = onTelemetryUpdate;
  }, [onSimCoordChange, onTelemetryUpdate]);

  useEffect(() => {
    onSimCoordChangeRef.current([activeNavState.lat, activeNavState.lng], activeNavState.heading);
    if (onTelemetryUpdateRef.current) {
      onTelemetryUpdateRef.current({
        lat: activeNavState.lat,
        lng: activeNavState.lng,
        heading: activeNavState.heading,
        speedKmh: activeNavState.speedKmh,
        progressPercent: activeNavState.progressPercentage,
        remainingMeters: activeNavState.remainingDistanceMeters,
        remainingSeconds: activeNavState.remainingSeconds,
        arrived: activeNavState.arrived
      });
    }
  }, [
    activeNavState.lat,
    activeNavState.lng,
    activeNavState.heading,
    activeNavState.speedKmh,
    activeNavState.progressPercentage,
    activeNavState.remainingDistanceMeters,
    activeNavState.remainingSeconds,
    activeNavState.arrived
  ]);

  // Turn-by-Turn Voice guidance synthesis using Web Speech API
  useEffect(() => {
    if (isVoiceMuted || !('speechSynthesis' in window)) return;

    if (activeNavState.currentStepIndex !== lastSpokenStepRef.current) {
      lastSpokenStepRef.current = activeNavState.currentStepIndex;
      const step = navigationSteps[activeNavState.currentStepIndex];
      if (step) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(
            `In ${activeNavState.distToNextTurn} meters, ${step.instruction}`
          );
          utterance.rate = 1.05;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('SpeechSynthesis warning:', e);
        }
      }
    }
  }, [activeNavState.currentStepIndex, isVoiceMuted, navigationSteps, activeNavState.distToNextTurn]);

  // Handle Off-Route Recalculation
  const handleRecalculate = async () => {
    if (!onRecalculateRoute || !realGpsPoint) return;
    setIsRecalculating(true);
    try {
      await onRecalculateRoute(realGpsPoint);
      setShowOffRouteAlert(false);
      offRouteCountRef.current = 0;
    } catch (e) {
      console.error('Route recalculation failed:', e);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Safe Havens proximity check
  const nearbySafeHaven = useMemo(() => {
    for (const fac of emergencyFacilities) {
      const d = computeHaversineMeters(activeNavState.lat, activeNavState.lng, fac.lat, fac.lng);
      if (d <= 280) {
        return { facility: fac, distanceMeters: Math.round(d) };
      }
    }
    return null;
  }, [activeNavState.lat, activeNavState.lng, emergencyFacilities]);

  // Formatted estimated clock arrival time
  const arrivalTimeFormatted = useMemo(() => {
    const arrivalDate = new Date(Date.now() + activeNavState.remainingSeconds * 1000);
    return arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [activeNavState.remainingSeconds]);

  // Formatted remaining time string
  const formattedRemainingTime = useMemo(() => {
    if (hasArrived || activeNavState.remainingSeconds <= 0) return 'Arrived!';
    const mins = Math.floor(activeNavState.remainingSeconds / 60);
    const secs = activeNavState.remainingSeconds % 60;
    if (mins >= 60) {
      return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
    }
    if (mins > 0) {
      return `${mins} min ${secs < 10 ? '0' : ''}${secs}s`;
    }
    return `${secs} sec`;
  }, [activeNavState.remainingSeconds, hasArrived]);

  const activeStep = navigationSteps[activeNavState.currentStepIndex] || navigationSteps[0];
  const nextStepPreview = navigationSteps[activeNavState.currentStepIndex + 1];

  const renderManeuverIcon = (type: string, className = 'w-9 h-9 text-white') => {
    switch (type) {
      case 'right':
      case 'slight-right':
        return <CornerUpRight className={className} />;
      case 'left':
      case 'slight-left':
        return <CornerUpLeft className={className} />;
      case 'arrive':
        return <MapPin className={className} />;
      default:
        return <ArrowUp className={className} />;
    }
  };

  // Dynamic Corridor Safety Score
  const baseSafetyScore = analysis?.safetyScore || 82;
  const currentDynamicSafetyScore = useMemo(() => {
    if (hasArrived) return 100;
    const boost = Math.round((100 - baseSafetyScore) * (activeNavState.progressPercentage / 100));
    return Math.min(100, baseSafetyScore + boost);
  }, [baseSafetyScore, activeNavState.progressPercentage, hasArrived]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between overflow-hidden">
      {/* ============================================================ */}
      {/* 1. TOP TURN-BY-TURN BANNER & SAFETY TELEMETRY               */}
      {/* ============================================================ */}
      <div className="p-3 sm:p-4 max-w-2xl w-full mx-auto pointer-events-auto space-y-2">
        {/* Dynamic Safety Corridor Progress Bar */}
        <div className="bg-[#0a2f14]/95 backdrop-blur-xl border border-emerald-500/35 rounded-2xl p-3 shadow-xl space-y-1.5 safety-score-glow">
          <div className="flex items-center justify-between text-xs text-white">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
              <span className="font-bold text-emerald-100">Live Safety Score</span>
              {trackingMode === 'demo' ? (
                <span className="bg-[#bf5af2] text-white font-black px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider">
                  DEMO MODE
                </span>
              ) : (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full text-[9px] font-bold">
                  REAL GPS {realGpsAccuracy ? `(±${Math.round(realGpsAccuracy)}m)` : ''}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-emerald-300 font-mono">
                {Math.round(activeNavState.progressPercentage)}% Traversed
              </span>
              <span className="bg-emerald-400 text-neutral-950 font-black px-2.5 py-0.5 rounded-full text-xs">
                {currentDynamicSafetyScore}/100
              </span>
            </div>
          </div>

          <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden p-0.5 border border-emerald-400/20">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-green-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(52,199,89,0.9)]"
              style={{ width: `${Math.max(5, activeNavState.progressPercentage)}%` }}
            />
          </div>
        </div>

        {/* Google Maps Green Turn Maneuver Card */}
        <div className="bg-[#137333] text-white rounded-3xl shadow-[0_12px_36px_rgba(0,0,0,0.4)] p-4 sm:p-5 flex flex-col space-y-2 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5 sm:space-x-4 flex-1 min-w-0">
              {/* Maneuver Icon */}
              <div className="w-13 h-13 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                {renderManeuverIcon(activeStep.type, 'w-8 h-8 sm:w-9 sm:h-9 text-white')}
              </div>

              {/* Turn Text */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-emerald-100/90 font-medium truncate mb-0.5 flex items-center space-x-1.5">
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-md font-bold text-white text-[9px] uppercase tracking-wider">
                    {analysis?.classificationLabel || 'Chosen Corridor'}
                  </span>
                  <span className="truncate">{route.name}</span>
                </div>
                <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <span>In {activeNavState.distToNextTurn} m</span>
                  <span className="text-white/40">·</span>
                  <span className="capitalize">{activeStep.type.replace('-', ' ')}</span>
                </div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate leading-snug">
                  {activeStep.instruction}
                </h1>
              </div>
            </div>

            {/* Voice Mute & Exit */}
            <div className="flex items-center space-x-2 shrink-0 ml-3">
              <button
                onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                className={`p-2.5 rounded-full transition ${
                  isVoiceMuted
                    ? 'bg-white/15 text-white/70 hover:bg-white/25'
                    : 'bg-white text-[#137333] shadow-md hover:bg-emerald-50'
                }`}
                title={isVoiceMuted ? 'Unmute Voice Guidance' : 'Mute Voice Guidance'}
              >
                {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                onClick={onExit}
                className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition"
                title="Exit Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-Maneuver Preview */}
          {nextStepPreview && (
            <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs text-emerald-100">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Then
                </span>
                <span className="truncate">{nextStepPreview.instruction}</span>
              </div>
              <span className="text-white/60 text-[11px] shrink-0 ml-2">
                in {Math.round(nextStepPreview.distanceMeters)}m
              </span>
            </div>
          )}
        </div>

        {/* Off-Route Alert Banner with Recalculation Trigger */}
        {showOffRouteAlert && (
          <div className="bg-[#ff453a] text-white rounded-2xl p-3 shadow-xl flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-white" />
              <div>
                <strong className="block font-bold">Off Planned Route</strong>
                <span className="text-[11px] text-white/90">
                  You are {activeNavState.distanceToRouteMeters}m away from the path.
                </span>
              </div>
            </div>

            <button
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="px-3 py-1.5 bg-white text-[#ff453a] hover:bg-neutral-100 font-bold rounded-xl text-xs transition shrink-0 flex items-center space-x-1 shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Routing...' : 'Recalculate'}</span>
            </button>
          </div>
        )}

        {/* Proximity Safe Haven / Police Station Alert */}
        {nearbySafeHaven && (
          <div className="bg-[#101114]/95 backdrop-blur-xl border border-blue-400/40 rounded-2xl p-3 shadow-lg flex items-center justify-between text-xs animate-in fade-in duration-300">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                🛡️
              </div>
              <div className="truncate">
                <span className="font-semibold text-white block truncate">
                  Safe Haven: {nearbySafeHaven.facility.name}
                </span>
                <span className="text-[11px] text-blue-300">
                  {nearbySafeHaven.distanceMeters}m away · Verified 24/7 Police Support
                </span>
              </div>
            </div>
            {nearbySafeHaven.facility.phone && (
              <a
                href={`tel:${nearbySafeHaven.facility.phone}`}
                className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-xl text-[11px] shrink-0 hover:bg-blue-700 transition"
              >
                Call Station
              </a>
            )}
          </div>
        )}

        {/* Silent Ping Toast */}
        {silentPingToast && (
          <div className="bg-neutral-900 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center space-x-2 animate-bounce border border-white/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{silentPingToast}</span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. FLOATING HUD WIDGETS (Speedometer, Compass, Re-center)    */}
      {/* ============================================================ */}
      <div className="px-4 py-2 flex items-center justify-between pointer-events-none">
        {/* Real Speedometer Badge */}
        <div className="pointer-events-auto bg-[#101114]/95 backdrop-blur-xl border border-white/15 rounded-2xl px-3.5 py-2 shadow-xl flex flex-col items-center">
          <span className="text-xl font-black text-white leading-none">
            {activeNavState.speedKmh}
          </span>
          <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider mt-0.5">
            km/h
          </span>
        </div>

        {/* Right Floating Controls: Re-center & Compass */}
        <div className="flex flex-col space-y-2 pointer-events-auto">
          {!isCameraFollowing && (
            <button
              onClick={onRecenter}
              className="flex items-center space-x-1.5 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-bold text-xs px-3.5 py-2.5 rounded-full shadow-2xl border border-white/20 transition active:scale-95 animate-bounce"
            >
              <LocateFixed className="w-4 h-4" />
              <span>Resume Follow</span>
            </button>
          )}

          <div className="w-10 h-10 bg-[#101114]/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/15 flex items-center justify-center text-white">
            <Compass
              className="w-5 h-5 text-red-500 transition-transform duration-300"
              style={{ transform: `rotate(${-activeNavState.heading}deg)` }}
            />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. BOTTOM NAVIGATION HUD & CONTROLS                          */}
      {/* ============================================================ */}
      <div className="p-3 sm:p-4 max-w-2xl w-full mx-auto pointer-events-auto">
        <div className="bg-[#101114]/98 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.5)] p-4 sm:p-5 space-y-3.5 text-white">
          {/* Top Row: Remaining Time, Distance, Arrival Clock */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#30d158] tracking-tight">
                  {formattedRemainingTime}
                </span>
                <span className="text-xs sm:text-sm text-[#a1a1aa] font-medium">
                  ({formatDistance(activeNavState.remainingDistanceMeters)})
                </span>
              </div>
              <div className="text-xs text-[#a1a1aa] mt-0.5">
                Estimated arrival at <strong className="text-white">{arrivalTimeFormatted}</strong>
              </div>
            </div>

            {/* Mode Switcher Button (Walk / Bike / Car + Real GPS vs Demo Mode) */}
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {onTravelModeChange && (
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-[11px]">
                  {([
                    { id: 'walking', label: 'Walk', icon: <Footprints className="w-3 h-3" /> },
                    { id: 'biking', label: 'Bike', icon: <Bike className="w-3 h-3" /> },
                    { id: 'driving', label: 'Car', icon: <Car className="w-3 h-3" /> }
                  ] as const).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onTravelModeChange(m.id)}
                      className={`flex items-center space-x-1 px-2 py-1 rounded-lg font-bold transition ${
                        travelMode === m.id
                          ? 'bg-[#0a84ff] text-white shadow-sm'
                          : 'text-[#a1a1aa] hover:text-white'
                      }`}
                    >
                      {m.icon}
                      <span className="hidden sm:inline">{m.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {onToggleTrackingMode && (
                <button
                  onClick={onToggleTrackingMode}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    trackingMode === 'real'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-[#bf5af2]/10 text-[#bf5af2] border-[#bf5af2]/30 hover:bg-[#bf5af2]/20'
                  }`}
                  title="Switch between Real GPS and Demo Mode"
                >
                  {trackingMode === 'real' ? 'Real GPS' : 'Demo Mode'}
                </button>
              )}

              <button
                onClick={onExit}
                className="flex items-center space-x-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-3 py-2 rounded-2xl text-xs font-bold transition border border-rose-500/30"
              >
                <X className="w-4 h-4" />
                <span>Exit</span>
              </button>
            </div>
          </div>

          {/* DEMO MODE SCRUBBER (Only rendered in Demo Mode) */}
          {trackingMode === 'demo' && (
            <div className="space-y-1 bg-white/5 p-2.5 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center text-[11px] text-[#a1a1aa] font-medium">
                <span className="text-[#bf5af2] font-bold">Simulated Route Scrubber</span>
                <span>{Math.round(demoProgress)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={demoProgress}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDemoProgress(val);
                  if (val < 100) setHasArrived(false);
                }}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#bf5af2]"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => {
                      if (hasArrived) {
                        setDemoProgress(0);
                        setHasArrived(false);
                        setDemoPlaying(true);
                      } else {
                        setDemoPlaying(!demoPlaying);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  >
                    {demoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => {
                      setDemoProgress(0);
                      setHasArrived(false);
                      setDemoPlaying(true);
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center bg-white/5 rounded-lg p-0.5 text-[10px]">
                    {[1, 2, 4, 8].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDemoSpeedMultiplier(s)}
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          demoSpeedMultiplier === s ? 'bg-[#bf5af2] text-white' : 'text-[#a1a1aa]'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-[10px] text-[#bf5af2]">Demo preview only</span>
              </div>
            </div>
          )}

          {/* FULL-TRIP CONTINUOUS LIVE SHARING STATUS BANNER */}
          {(() => {
            const savedContacts = getLocalSavedContacts();
            const defId = getDefaultWhatsAppContactId();
            const defContact = savedContacts.find((c) => c.id === defId) || savedContacts[0] || null;
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl px-3 py-2 text-xs">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-ping shrink-0" />
                  <span className="text-[#25D366] font-bold truncate">
                    Live Trip Sharing ({Math.round(activeNavState.progressPercentage)}% of Full Route):
                  </span>
                  <span className="text-white font-medium truncate">
                    {defContact ? `${defContact.name} (${defContact.phone})` : 'Streaming Live Link'}
                  </span>
                </div>
                {onOpenShareModal && (
                  <button
                    type="button"
                    onClick={onOpenShareModal}
                    className="px-2.5 py-1 bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold rounded-xl text-[11px] transition shrink-0 flex items-center space-x-1"
                  >
                    <MessageCircle className="w-3 h-3 fill-black" />
                    <span>{defContact ? 'Share / Manage' : 'Add Contact & Share'}</span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* Action Row: Steps, Safe Ping, Emergency SOS */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <button
              onClick={() => setIsStepsDrawerOpen(!isStepsDrawerOpen)}
              className="flex items-center space-x-1 px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold transition"
            >
              <List className="w-3.5 h-3.5" />
              <span>Turn Maneuvers</span>
              {isStepsDrawerOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>

            <div className="flex items-center space-x-2">
              {(() => {
                const savedContacts = getLocalSavedContacts();
                const defId = getDefaultWhatsAppContactId();
                const defContact = savedContacts.find((c) => c.id === defId) || savedContacts[0] || null;
                const shareUrl = activeJourneySession
                  ? `${window.location.origin}/#share-${activeJourneySession.token}`
                  : undefined;
                const safePingHref = buildWhatsAppSafePingUrl({
                  contactPhone: defContact?.phone,
                  contactName: defContact?.name,
                  travelerName: getSavedTravelerName() || undefined,
                  destAddress,
                  currentCoords: [activeNavState.lat, activeNavState.lng],
                  progressPercent: activeNavState.progressPercentage,
                  remainingTimeText: formattedRemainingTime,
                  shareUrl
                });
                return (
                  <a
                    href={safePingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setSilentPingToast(
                        defContact
                          ? `Opening WhatsApp Live Progress Update to ${defContact.name} (${defContact.phone})`
                          : 'Opening WhatsApp Live Progress Update'
                      );
                      setTimeout(() => setSilentPingToast(null), 3500);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 rounded-xl text-xs font-bold transition"
                    title={
                      defContact
                        ? `Send live GPS check-in on WhatsApp to ${defContact.name}`
                        : 'Send live GPS check-in on WhatsApp'
                    }
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-[#25D366]/30" />
                    <span>{defContact ? `Update ${defContact.name.split(' ')[0]} (${Math.round(activeNavState.progressPercentage)}%)` : 'WhatsApp Update'}</span>
                  </a>
                );
              })()}

              <button
                onClick={onOpenSos}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#ff453a] hover:bg-[#ff3b30] text-white rounded-xl text-xs font-black shadow-lg transition active:scale-95"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>112 SOS</span>
              </button>
            </div>
          </div>

          {/* Expandable Turn Maneuvers Drawer */}
          {isStepsDrawerOpen && (
            <div className="mt-3 pt-3 border-t border-white/10 max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider block mb-1">
                Route Guidance Steps ({navigationSteps.length})
              </span>
              {navigationSteps.map((step, idx) => {
                const isCurrent = idx === activeNavState.currentStepIndex;
                const isPast = idx < activeNavState.currentStepIndex;
                return (
                  <div
                    key={step.id}
                    className={`flex items-start space-x-3 p-2.5 rounded-xl text-xs transition ${
                      isCurrent
                        ? 'bg-emerald-500/20 border border-emerald-400/40 font-medium text-emerald-200'
                        : isPast
                        ? 'opacity-40 text-neutral-400'
                        : 'text-neutral-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {renderManeuverIcon(
                        step.type,
                        `w-4 h-4 ${isCurrent ? 'text-emerald-400' : 'text-neutral-400'}`
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div>{step.instruction}</div>
                      <div className="text-[10px] text-[#86868b]">
                        {Math.round(step.distanceMeters)} m
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. DESTINATION ARRIVAL CELEBRATION MODAL                    */}
      {/* ============================================================ */}
      {hasArrived && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto z-50 animate-in fade-in duration-300">
          <div className="bg-[#101114] border border-white/15 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl text-white">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Full Trip Completed (100%)
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                You have arrived safely!
              </h2>
              <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                {destAddress}
              </p>
            </div>

            <div className="bg-[#17181c] p-3 rounded-2xl border border-white/10 text-xs text-left space-y-1.5">
              <div className="flex justify-between text-[#a1a1aa]">
                <span>Total Distance:</span>
                <span className="font-semibold text-white">
                  {formatDistance(totalDistanceMeters)}
                </span>
              </div>
              <div className="flex justify-between text-[#a1a1aa]">
                <span>Live Trip Status:</span>
                <span className="font-semibold text-emerald-400">
                  Arrived Safely (100% Synced)
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {(() => {
                const savedContacts = getLocalSavedContacts();
                const defId = getDefaultWhatsAppContactId();
                const defContact = savedContacts.find((c) => c.id === defId) || savedContacts[0] || null;
                const arrivalHref = buildWhatsAppArrivalUrl({
                  contactPhone: defContact?.phone,
                  contactName: defContact?.name,
                  travelerName: getSavedTravelerName() || undefined,
                  destAddress,
                  currentCoords: [activeNavState.lat, activeNavState.lng]
                });
                return (
                  <a
                    href={arrivalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold rounded-2xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-[#25D366]/25"
                  >
                    <MessageCircle className="w-4 h-4 fill-black" />
                    <span>
                      {defContact
                        ? `Notify ${defContact.name} on WhatsApp: Arrived Safely`
                        : 'Share Safe Arrival on WhatsApp'}
                    </span>
                  </a>
                );
              })()}

              <button
                onClick={onExit}
                className="w-full py-3 bg-[#30d158] hover:bg-[#28b84c] text-black font-bold rounded-2xl text-xs transition shadow-lg shadow-[#30d158]/20"
              >
                Complete & Exit Navigation
              </button>

              {trackingMode === 'demo' && (
                <button
                  onClick={() => {
                    setDemoProgress(0);
                    setHasArrived(false);
                    setDemoPlaying(true);
                  }}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-2xl text-xs transition"
                >
                  Replay Route Simulation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
