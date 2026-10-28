import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Navigation,
  Clock,
  Shield,
  PhoneCall,
  CheckCircle2,
  Copy,
  AlertTriangle,
  StopCircle,
  Share2,
  MapPin,
  ExternalLink,
  LocateFixed,
  MessageCircle,
  UserPlus,
  Star,
  Trash2
} from 'lucide-react';
import { MapComponent } from '../components/MapComponent';
import { GoogleMapsNavigationSimulator, LiveTripTelemetry } from '../components/GoogleMapsNavigationSimulator';
import { GpsStatusIndicator } from '../components/GpsStatusIndicator';
import { useRealtimeGps } from '../hooks/useRealtimeGps';
import { api } from '../services/api';
import { JourneySession, RouteGeometryItem, TrustedContact } from '../types';
import { computeHaversineMeters, formatDuration } from '../utils/geoUtils';
import {
  buildWhatsAppTripShareUrl,
  getDefaultWhatsAppContactId,
  setDefaultWhatsAppContactId,
  getSavedTravelerName
} from '../utils/whatsappUtils';

interface JourneySharingPageProps {
  journeyData?: {
    startAddress: string;
    destAddress: string;
    startCoords: [number, number];
    destCoords: [number, number];
    etaMinutes: number;
  } | null;
  onOpenSos: () => void;
  onSelectTab: (tab: string) => void;
  userCoords?: [number, number] | null;
}

export const JourneySharingPage: React.FC<JourneySharingPageProps> = ({
  journeyData,
  onOpenSos,
  onSelectTab,
  userCoords
}) => {
  const gps = useRealtimeGps(true);
  const [activeSession, setActiveSession] = useState<JourneySession | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteGeometryItem | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [defaultContactId, setDefaultContactId] = useState<string | null>(getDefaultWhatsAppContactId());
  const [showAddContact, setShowAddContact] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newContactRel, setNewContactRel] = useState<string>('Family');
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(15);

  // Google Maps simulation states
  const [isGmapsNavOpen, setIsGmapsNavOpen] = useState<boolean>(true);
  const [navSimCoord, setNavSimCoord] = useState<[number, number] | null>(null);
  const [navSimHeading, setNavSimHeading] = useState<number>(0);
  const [isCameraFollowing, setIsCameraFollowing] = useState<boolean>(true);

  const lastLocationSentTimeRef = useRef<number>(0);
  const lastLocationSentCoordRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    async function initJourney() {
      try {
        const contactList = await api.getContacts();
        setContacts(contactList);

        const activeRes = await api.getActiveJourney();
        let currentSession: JourneySession | null = null;
        if (activeRes.activeJourney) {
          currentSession = activeRes.activeJourney;
          setActiveSession(currentSession);
        } else if (journeyData) {
          currentSession = await api.startJourney({
            startAddress: journeyData.startAddress,
            destAddress: journeyData.destAddress,
            startCoords: journeyData.startCoords,
            destCoords: journeyData.destCoords,
            etaMinutes: journeyData.etaMinutes
          });
          setActiveSession(currentSession);
        }

        // Fetch OSRM road geometry
        if (currentSession) {
          try {
            const routesRes = await api.getRouteAlternatives(
              currentSession.startCoords,
              currentSession.destCoords,
              'driving'
            );
            if (routesRes.routes && routesRes.routes.length > 0) {
              setActiveRoute(routesRes.routes[0]);
            }
          } catch (routeErr) {
            console.warn('Could not fetch OSRM route for journey session:', routeErr);
          }
        }
      } catch (err) {
        console.error('Error starting journey:', err);
      }
    }
    initJourney();
  }, [journeyData]);

  // Real GPS & Full-Trip Telemetry Relay to Backend (Every 2.5s throughout the full trip)
  const handleTelemetryUpdate = (telemetry: LiveTripTelemetry) => {
    setProgressPercent(Math.round(telemetry.progressPercent));
    if (!activeSession || activeSession.status !== 'in_progress') return;

    const now = Date.now();
    if (!telemetry.arrived && now - lastLocationSentTimeRef.current < 2500) {
      return;
    }
    lastLocationSentTimeRef.current = now;
    lastLocationSentCoordRef.current = [telemetry.lat, telemetry.lng];

    api
      .updateJourneyLocation(activeSession.id, telemetry.lat, telemetry.lng, {
        progressPercent: telemetry.progressPercent,
        remainingMeters: telemetry.remainingMeters,
        remainingSeconds: telemetry.remainingSeconds,
        speedKmh: telemetry.speedKmh,
        heading: telemetry.heading,
        accuracy: gps.accuracy ?? 12,
        status: telemetry.arrived ? 'completed' : 'in_progress'
      })
      .then((res) => {
        if (res.status === 'completed' && activeSession.status !== 'completed') {
          setActiveSession((prev) => (prev ? { ...prev, status: 'completed', progressPercent: 100 } : prev));
        }
      })
      .catch(() => {});
  };

  // Fallback Real GPS Location Relay when turn-by-turn HUD is closed
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'in_progress' || isGmapsNavOpen) return;
    if (!gps.coords) return;

    const [lat, lng] = gps.coords;
    const now = Date.now();
    if (now - lastLocationSentTimeRef.current < 3000) return;

    lastLocationSentTimeRef.current = now;
    lastLocationSentCoordRef.current = [lat, lng];
    api
      .updateJourneyLocation(activeSession.id, lat, lng, {
        speedKmh: gps.speed ? Math.round(gps.speed * 3.6) : 0,
        heading: gps.heading,
        accuracy: gps.accuracy ?? 12
      })
      .catch(() => {});
  }, [gps.coords, gps.speed, gps.heading, gps.accuracy, activeSession, isGmapsNavOpen]);

  const handleEndJourney = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await api.endJourney(activeSession.id);
      setActiveSession({ ...activeSession, status: 'completed' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = activeSession
    ? `${window.location.origin}/#share-${activeSession.token}`
    : `${window.location.origin}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const defaultContact =
    contacts.find((c) => c.id === defaultContactId) || contacts[0] || null;

  const handleQuickSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    try {
      const created = await api.addContact({
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
        relationship: newContactRel,
        receiveSos: true,
        receiveJourney: true
      });
      const updated = [...contacts, created];
      setContacts(updated);
      if (!defaultContactId || updated.length === 1) {
        setDefaultContactId(created.id);
        setDefaultWhatsAppContactId(created.id);
      }
      setNewContactName('');
      setNewContactPhone('');
      setShowAddContact(false);
    } catch (err) {
      console.error(err);
    }
  };

  const getWhatsAppShareLink = (contact?: TrustedContact | null) => {
    const startC: [number, number] = activeSession?.startCoords || gps.coords || [11.0168, 76.9558];
    const destC: [number, number] = activeSession?.destCoords || [11.0112, 76.9458];
    const curC: [number, number] = gps.coords || activeSession?.currentCoords || startC;
    return buildWhatsAppTripShareUrl({
      contactPhone: contact?.phone,
      contactName: contact?.name,
      travelerName: getSavedTravelerName() || activeSession?.userName || undefined,
      startAddress: activeSession?.startAddress || 'Current Location',
      destAddress: activeSession?.destAddress || 'Destination',
      currentCoords: curC,
      startCoords: startC,
      destCoords: destC,
      etaText: formatDuration((activeSession?.etaMinutes || 15) * 60),
      shareUrl
    });
  };

  const routePolyline: RouteGeometryItem[] = activeRoute
    ? [activeRoute]
    : activeSession
    ? [
        {
          name: 'Active Journey Route',
          coordinates: [
            [activeSession.startCoords[1], activeSession.startCoords[0]],
            [activeSession.destCoords[1], activeSession.destCoords[0]]
          ],
          distanceMeters: 1400,
          durationSeconds: (activeSession.etaMinutes || 15) * 60,
          summary: 'In Progress Corridor',
          steps: []
        }
      ]
    : [];

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden bg-[#08090b] text-[#f5f5f7]">
      {/* LEFT PANEL: Live Tracking Controls & Contacts */}
      <div className="w-full lg:w-96 xl:w-[420px] bg-[#101114] border-r border-white/10 flex flex-col shrink-0 overflow-y-auto p-5 space-y-5 z-10 custom-scrollbar">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#30d158] animate-pulse"></span>
            <h1 className="text-lg font-bold text-[#f5f5f7] tracking-tight">
              Live Journey Sharing
            </h1>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
            End-to-end tokenized tracking with your designated emergency contacts.
          </p>
        </div>

        {activeSession ? (
          <>
            {/* Status Card */}
            <div className="bg-[#17181c] rounded-3xl p-5 border border-white/10 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#a1a1aa] uppercase tracking-wider">
                  Session Status
                </span>
                <span
                  className={`font-semibold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                    activeSession.status === 'in_progress'
                      ? 'bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/20'
                      : 'bg-white/10 text-[#a1a1aa]'
                  }`}
                >
                  {activeSession.status === 'in_progress' ? '● En Route' : 'Completed'}
                </span>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[#a1a1aa]">Progress</span>
                  <span className="font-bold text-[#64b5ff]">{progressPercent}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#0a84ff] h-2 rounded-full transition-all duration-700"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Waypoints */}
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#0a84ff] text-white flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                    A
                  </span>
                  <div>
                    <span className="text-[10px] text-[#a1a1aa] block font-semibold">ORIGIN</span>
                    <span className="font-medium text-[#f5f5f7]">{activeSession.startAddress}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-[#ff453a] text-white flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                    B
                  </span>
                  <div>
                    <span className="text-[10px] text-[#a1a1aa] block font-semibold">DESTINATION</span>
                    <span className="font-medium text-[#f5f5f7]">{activeSession.destAddress}</span>
                  </div>
                </div>
              </div>

              {/* ETA Display */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-[#a1a1aa]">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0a84ff]" />
                  <span>ETA: ~{activeSession.etaMinutes} mins</span>
                </div>
                <span className="text-[11px] font-mono text-[#f5f5f7]">
                  Expires: {new Date(activeSession.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Default WhatsApp One-Tap Share Box */}
            <div className="bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/15 rounded-3xl p-4 border border-[#25D366]/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <MessageCircle className="w-4 h-4 text-[#25D366] fill-[#25D366]/20" />
                  <span>Default WhatsApp Sharing</span>
                </span>
                <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] font-bold px-2 py-0.5 rounded-full">
                  Live GPS Link
                </span>
              </div>

              {defaultContact ? (
                <>
                  <div className="text-xs text-[#f5f5f7] flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <div className="font-bold">{defaultContact.name}</div>
                      <div className="text-[11px] text-[#a1a1aa] font-mono">{defaultContact.phone}</div>
                    </div>
                    <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full font-bold">
                      Default
                    </span>
                  </div>
                  <a
                    href={getWhatsAppShareLink(defaultContact)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center space-x-2 bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold py-2.5 px-4 rounded-xl text-xs transition shadow-lg shadow-[#25D366]/20"
                  >
                    <MessageCircle className="w-4 h-4 fill-black text-black" />
                    <span>Share Live Trip on WhatsApp to {defaultContact.name}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              ) : (
                <p className="text-[11px] text-[#a1a1aa]">
                  Save a real contact below to enable instant 1-tap WhatsApp trip sharing.
                </p>
              )}

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-[#a1a1aa] w-full font-mono select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white rounded-xl text-xs font-bold transition shrink-0 flex items-center space-x-1"
                >
                  {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Real Saved Contacts + Add Manual Contact */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">
                  Saved Contacts ({contacts.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="flex items-center space-x-1 text-xs font-bold text-[#64b5ff] hover:text-white"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showAddContact ? 'Cancel' : 'Add Contact'}</span>
                </button>
              </div>

              {showAddContact && (
                <form
                  onSubmit={handleQuickSaveContact}
                  className="bg-[#17181c] p-3.5 rounded-2xl border border-[#0a84ff]/40 space-y-2.5 text-xs"
                >
                  <input
                    type="text"
                    required
                    placeholder="Contact Name (e.g. Mom / Karthik)"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full bg-[#101114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="WhatsApp Mobile Number (e.g. +91 9876543210)"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full bg-[#101114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={newContactRel}
                      onChange={(e) => setNewContactRel(e.target.value)}
                      className="bg-[#101114] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="Family">Family</option>
                      <option value="Parent">Parent</option>
                      <option value="Partner">Partner</option>
                      <option value="Friend">Friend</option>
                    </select>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-bold rounded-xl text-xs"
                    >
                      Save Contact
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {contacts.length === 0 ? (
                  <div className="p-3 bg-[#17181c] rounded-2xl border border-white/5 text-xs text-[#a1a1aa] text-center">
                    No contacts saved yet. Click "Add Contact" above to save a real person's WhatsApp number.
                  </div>
                ) : (
                  contacts.map((c) => {
                    const isDef = c.id === defaultContact?.id;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between bg-[#17181c] p-3 rounded-2xl border border-white/10 text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#f5f5f7] truncate">{c.name}</div>
                          <div className="text-[10px] text-[#a1a1aa] font-mono">{c.phone}</div>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <a
                            href={getWhatsAppShareLink(c)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold rounded-xl text-[11px] flex items-center space-x-1"
                          >
                            <MessageCircle className="w-3 h-3 fill-black" />
                            <span>WhatsApp</span>
                          </a>
                          {!isDef && (
                            <button
                              type="button"
                              onClick={() => {
                                setDefaultContactId(c.id);
                                setDefaultWhatsAppContactId(c.id);
                              }}
                              className="p-1.5 text-[#a1a1aa] hover:text-[#25D366] rounded-lg"
                              title="Set as Default WhatsApp Contact"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Emergency & End Journey Actions */}
            <div className="pt-2 space-y-2">
              <button
                onClick={onOpenSos}
                className="w-full flex items-center justify-center space-x-2 bg-[#ff453a] hover:bg-[#ff3b30] text-white font-bold py-3 rounded-2xl transition text-xs shadow-lg shadow-[#ff453a]/20"
              >
                <Shield className="w-4 h-4 fill-white" />
                <span>Instant Emergency SOS (112)</span>
              </button>

              {activeSession.status === 'in_progress' && (
                <button
                  onClick={handleEndJourney}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-1.5 bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-[#f5f5f7] py-2.5 rounded-2xl transition text-xs font-semibold"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>End Live Sharing Session</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-center bg-[#17181c] rounded-3xl border border-white/10 space-y-3">
            <MapPin className="w-8 h-8 text-[#0a84ff] mx-auto" />
            <h3 className="font-bold text-[#f5f5f7] text-sm">No Active Sharing Session</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Calculate a safe route in the Route Planner and tap "Share Live Trip" to initiate real-time GPS tracking with your trusted circle.
            </p>
            <button
              onClick={() => onSelectTab('route-planner')}
              className="mt-2 px-4 py-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white rounded-xl text-xs font-semibold transition"
            >
              Open Route Planner
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Live Map & Google Maps Navigation HUD */}
      <div className="flex-1 relative flex flex-col">
        {/* Floating Top Controls: GPS Indicator */}
        <div className="absolute top-3 left-3 z-20 flex items-center space-x-2">
          <GpsStatusIndicator
            status={gps.status}
            accuracy={gps.accuracy}
            speed={gps.speed}
            heading={gps.heading}
            timestamp={gps.timestamp}
            isStale={gps.isStale}
            trackingMode={gps.trackingMode}
            onRequestPermission={gps.requestPermission}
            onToggleMode={() => gps.setDemoMode(gps.trackingMode === 'real')}
            onRefresh={gps.refreshLocation}
          />
        </div>

        <MapComponent
          center={gps.coords || activeSession?.startCoords || userCoords || [11.0168, 76.9558]}
          zoom={isGmapsNavOpen ? 16 : 15}
          startCoords={activeSession?.startCoords}
          destCoords={activeSession?.destCoords}
          routes={routePolyline}
          currentLocation={gps.coords || userCoords || undefined}
          realGpsPoint={gps.coords}
          realGpsAccuracy={gps.accuracy}
          realGpsHeading={gps.heading}
          realGpsSpeed={gps.speed}
          trackingMode={gps.trackingMode}
          followVehicle={isGmapsNavOpen && isCameraFollowing}
          onCameraMovedByUser={() => setIsCameraFollowing(false)}
          onToggleFollow={() => setIsCameraFollowing(true)}
          onRequestMyLocation={gps.refreshLocation}
          simulationPoint={
            isGmapsNavOpen && gps.trackingMode === 'demo'
              ? navSimCoord
              : null
          }
          simulationHeading={isGmapsNavOpen && gps.trackingMode === 'demo' ? navSimHeading : undefined}
          followSimulation={isGmapsNavOpen && isCameraFollowing && gps.trackingMode === 'demo'}
          simulationLabel="Live Journey"
          className="w-full h-full"
        />

        {/* Turn-By-Turn HUD */}
        {isGmapsNavOpen && activeSession && activeSession.status === 'in_progress' && (
          <GoogleMapsNavigationSimulator
            route={
              activeRoute || {
                name: 'Active Corridor',
                coordinates: [
                  [activeSession.startCoords[1], activeSession.startCoords[0]],
                  [activeSession.destCoords[1], activeSession.destCoords[0]]
                ],
                distanceMeters: 1800,
                durationSeconds: (activeSession.etaMinutes || 12) * 60,
                summary: 'Direct Corridor',
                steps: []
              }
            }
            startAddress={activeSession.startAddress}
            destAddress={activeSession.destAddress}
            destCoords={activeSession.destCoords}
            travelMode="driving"
            onExit={() => setIsGmapsNavOpen(false)}
            onOpenSos={onOpenSos}
            onSimCoordChange={(coord, heading) => {
              setNavSimCoord(coord);
              setNavSimHeading(heading);
            }}
            isCameraFollowing={isCameraFollowing}
            onRecenter={() => setIsCameraFollowing(true)}
            realGpsPoint={gps.coords}
            realGpsAccuracy={gps.accuracy}
            realGpsHeading={gps.heading}
            realGpsSpeed={gps.speed}
            isGpsStale={gps.isStale}
            trackingMode={gps.trackingMode}
            onToggleTrackingMode={() => gps.setDemoMode(gps.trackingMode === 'real')}
            activeJourneySession={activeSession}
            onTelemetryUpdate={handleTelemetryUpdate}
          />
        )}
      </div>
    </div>
  );
};
