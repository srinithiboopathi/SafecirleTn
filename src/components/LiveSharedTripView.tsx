import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Navigation,
  MapPin,
  Clock,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Footprints,
  Bike,
  Car,
  LocateFixed,
  Radio
} from 'lucide-react';
import { MapComponent } from './MapComponent';
import { api } from '../services/api';
import { JourneySession, RouteGeometryItem } from '../types';
import { computeHaversineMeters, formatDistance, formatDuration } from '../utils/geoUtils';

interface LiveSharedTripViewProps {
  token: string;
  onExitShareView: () => void;
}

export const LiveSharedTripView: React.FC<LiveSharedTripViewProps> = ({
  token,
  onExitShareView
}) => {
  const [session, setSession] = useState<JourneySession | null>(null);
  const [route, setRoute] = useState<RouteGeometryItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPolled, setLastPolled] = useState<Date>(new Date());
  const [followTraveler, setFollowTraveler] = useState<boolean>(true);

  const fetchSharedSession = async () => {
    try {
      const data = await api.getSharedJourney(token);
      setSession(data);
      setError(null);
      setLastPolled(new Date());

      if (!route) {
        if (data.routeCoordinates && data.routeCoordinates.length > 1) {
          setRoute({
            name: 'Shared Full-Trip Corridor',
            coordinates: data.routeCoordinates,
            distanceMeters: data.remainingMeters || 2000,
            durationSeconds: data.remainingSeconds || (data.etaMinutes || 15) * 60,
            summary: 'Live Shared Route',
            steps: []
          });
        } else if (data.startCoords && data.destCoords) {
          try {
            const res = await api.getRouteAlternatives(
              data.startCoords,
              data.destCoords,
              data.travelMode || 'driving'
            );
            if (res.routes && res.routes.length > 0) {
              setRoute(res.routes[0]);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message || 'Live trip session not found or has ended.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedSession();
    const interval = setInterval(fetchSharedSession, 2500);
    return () => clearInterval(interval);
  }, [token]);

  const computedProgress = useMemo(() => {
    if (!session) return 0;
    if (session.status === 'completed') return 100;
    if (typeof session.progressPercent === 'number') {
      return Math.min(100, Math.max(0, session.progressPercent));
    }
    const totalDist = computeHaversineMeters(
      session.startCoords[0],
      session.startCoords[1],
      session.destCoords[0],
      session.destCoords[1]
    );
    const remDist = computeHaversineMeters(
      session.currentCoords[0],
      session.currentCoords[1],
      session.destCoords[0],
      session.destCoords[1]
    );
    if (totalDist <= 10) return 100;
    return Math.min(100, Math.max(0, Math.round(((totalDist - remDist) / totalDist) * 100)));
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090b] text-white flex flex-col items-center justify-center p-6 space-y-3">
        <RefreshCw className="w-8 h-8 text-[#30d158] animate-spin" />
        <p className="text-sm font-semibold">Connecting to Continuous Full-Trip GPS Stream...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#08090b] text-white flex flex-col items-center justify-center p-6">
        <div className="bg-[#17181c] border border-white/10 rounded-3xl p-6 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold">Live Trip Link Unavailable</h2>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            {error || 'This live sharing link has expired or the traveler has completed their trip.'}
          </p>
          <button
            onClick={onExitShareView}
            className="w-full py-2.5 bg-[#0a84ff] hover:bg-[#0077ed] text-white rounded-xl text-xs font-bold transition"
          >
            Open SafeCircle Route Planner
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = session.status === 'completed' || computedProgress >= 100;

  const remainingMeters = isCompleted
    ? 0
    : typeof session.remainingMeters === 'number'
    ? session.remainingMeters
    : computeHaversineMeters(
        session.currentCoords[0],
        session.currentCoords[1],
        session.destCoords[0],
        session.destCoords[1]
      );

  const remainingTimeText = isCompleted
    ? 'Arrived'
    : typeof session.remainingSeconds === 'number'
    ? formatDuration(session.remainingSeconds)
    : `~${session.etaMinutes} min`;

  const googleMapsPinUrl = `https://www.google.com/maps?q=${session.currentCoords[0].toFixed(6)},${session.currentCoords[1].toFixed(6)}`;
  const googleMapsRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${session.startCoords[0].toFixed(6)},${session.startCoords[1].toFixed(6)}&destination=${session.destCoords[0].toFixed(6)},${session.destCoords[1].toFixed(6)}`;

  const modeBadge =
    session.travelMode === 'walking' ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#64b5ff]">
        <Footprints className="w-3.5 h-3.5" /> Walking
      </span>
    ) : session.travelMode === 'biking' ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#64b5ff]">
        <Bike className="w-3.5 h-3.5" /> Bike
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#64b5ff]">
        <Car className="w-3.5 h-3.5" /> Car
      </span>
    );

  // Convert breadcrumbs to waypoints or displayable trail
  const activeRoutes: RouteGeometryItem[] = route
    ? [route]
    : [
        {
          name: 'Full Trip Corridor',
          coordinates: [
            [session.startCoords[1], session.startCoords[0]],
            ...(session.breadcrumbs || []).map((b) => [b.lng, b.lat] as [number, number]),
            [session.destCoords[1], session.destCoords[0]]
          ],
          distanceMeters: Math.max(remainingMeters, 500),
          durationSeconds: (session.etaMinutes || 15) * 60,
          summary: 'Live Corridor',
          steps: []
        }
      ];

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#08090b] text-[#f5f5f7]">
      {/* Left Guardian Panel */}
      <div className="w-full lg:w-[400px] bg-[#101114] border-r border-white/10 p-5 flex flex-col justify-between overflow-y-auto z-10 space-y-4 custom-scrollbar">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onExitShareView}
              className="flex items-center space-x-1.5 text-xs text-[#a1a1aa] hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Open SafeCircle App</span>
            </button>
            <span className="text-[10px] font-bold bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] animate-ping" />
              FULL-TRIP LIVE GUARDIAN
            </span>
          </div>

          {/* Arrived Safely Banner */}
          {isCompleted && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center space-x-3 text-emerald-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">Arrived Safely at Destination!</div>
                <div className="text-[11px] text-emerald-200/90">
                  {session.userName || 'Traveler'} has completed the full trip to {session.destAddress}.
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#17181c] border border-white/10 rounded-3xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider">
                  Live Full-Trip Tracking
                </div>
                <h1 className="text-base font-bold text-white">{session.userName || 'Traveler'}</h1>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  !isCompleted
                    ? 'bg-[#30d158]/20 text-[#30d158] border border-[#30d158]/30'
                    : 'bg-emerald-500 text-black'
                }`}
              >
                {!isCompleted ? '● Moving Live' : '✓ Arrived Safely'}
              </span>
            </div>

            {/* Full-Trip Progress Bar (0% -> 100%) */}
            <div className="bg-[#101114] p-3 rounded-2xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#a1a1aa] font-semibold">Full Trip Progress</span>
                <span className="font-extrabold text-[#30d158]">{computedProgress}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0a84ff] via-[#30d158] to-[#25D366] rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(5, computedProgress)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#86868b]">
                <span>Origin (A)</span>
                <span>{session.breadcrumbs?.length || 1} GPS checkpoints logged</span>
                <span>Destination (B)</span>
              </div>
            </div>

            {/* Origin & Destination */}
            <div className="space-y-2.5 text-xs pt-1 border-t border-white/10">
              <div className="flex items-start space-x-2">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  A
                </span>
                <div>
                  <span className="text-[10px] text-[#a1a1aa] font-bold block">START ORIGIN</span>
                  <span className="text-white font-medium">{session.startAddress}</span>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  B
                </span>
                <div>
                  <span className="text-[10px] text-[#a1a1aa] font-bold block">DESTINATION</span>
                  <span className="text-white font-medium">{session.destAddress}</span>
                </div>
              </div>
            </div>

            {/* Live Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="bg-[#101114] p-2.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-[#a1a1aa] block">Remaining Distance</span>
                <span className="font-bold text-[#30d158] text-sm">
                  {isCompleted ? '0 m (Arrived)' : formatDistance(remainingMeters)}
                </span>
              </div>
              <div className="bg-[#101114] p-2.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-[#a1a1aa] block">Remaining ETA</span>
                <span className="font-bold text-white text-sm">{remainingTimeText}</span>
              </div>
              <div className="bg-[#101114] p-2.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-[#a1a1aa] block">Travel Mode</span>
                <div className="mt-0.5">{modeBadge}</div>
              </div>
              <div className="bg-[#101114] p-2.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-[#a1a1aa] block">Live Speed</span>
                <span className="font-bold text-white text-sm">
                  {session.speedKmh !== undefined ? `${session.speedKmh} km/h` : 'Live GPS'}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-[#a1a1aa] font-mono pt-1 flex items-center justify-between">
              <span>
                GPS: {session.currentCoords[0].toFixed(5)}, {session.currentCoords[1].toFixed(5)}
              </span>
              <span className="text-[10px] text-[#30d158]">
                Synced {lastPolled.toLocaleTimeString()}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={googleMapsPinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
              >
                <MapPin className="w-4 h-4" />
                <span>Open Current Moving GPS Pin in Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={googleMapsRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 bg-white/10 hover:bg-white/15 text-white font-semibold py-2 px-4 rounded-xl text-xs transition"
              >
                <Navigation className="w-3.5 h-3.5 text-[#30d158]" />
                <span>View Full Route Corridor in Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-[#a1a1aa] bg-[#17181c] p-3.5 rounded-2xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-[#30d158] animate-pulse shrink-0" />
            <span>Continuous full-trip GPS stream (updates every 2.5s)</span>
          </div>
        </div>
      </div>

      {/* Right Map View */}
      <div className="flex-1 relative">
        {!followTraveler && (
          <div className="absolute top-4 left-4 z-30">
            <button
              onClick={() => setFollowTraveler(true)}
              className="flex items-center space-x-1.5 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-bold text-xs px-3.5 py-2 rounded-full shadow-2xl border border-white/20 transition"
            >
              <LocateFixed className="w-4 h-4" />
              <span>Follow Traveler Live</span>
            </button>
          </div>
        )}

        <MapComponent
          center={session.currentCoords}
          zoom={16}
          startCoords={session.startCoords}
          destCoords={session.destCoords}
          routes={activeRoutes}
          currentLocation={session.currentCoords}
          realGpsPoint={session.currentCoords}
          realGpsHeading={session.heading ?? null}
          realGpsSpeed={session.speedKmh ? session.speedKmh / 3.6 : null}
          realGpsAccuracy={session.accuracy ?? 12}
          trackingMode="real"
          followVehicle={followTraveler}
          onCameraMovedByUser={() => setFollowTraveler(false)}
          onToggleFollow={() => setFollowTraveler(true)}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};
