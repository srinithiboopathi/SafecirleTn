import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapComponent, calculateBearing } from '../components/MapComponent';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput';
import { BatteryConnectivityGuardian } from '../components/BatteryConnectivityGuardian';
import { api } from '../services/api';
import { Incident, EmergencyFacility, UserProfile, RouteOption } from '../types';
import {
  TAMIL_NADU_DISTRICTS,
  isCoordinateInTamilNadu,
  resolveTamilNaduDistrict
} from '../utils/tamilNaduGeo';
import {
  Navigation,
  AlertTriangle,
  Phone,
  Bot,
  UserPlus,
  Trash2,
  CloudRain,
  Radio,
  CheckCircle2,
  Crosshair,
  BarChart3,
  Users,
  Play,
  Pause
} from 'lucide-react';

interface DashboardProps {
  userLocation: [number, number];
  onTriggerSOS: () => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ userLocation, onTriggerSOS }) => {
  const [activeCoords, setActiveCoords] = useState<[number, number]>(() =>
    isCoordinateInTamilNadu(userLocation[0], userLocation[1])
      ? userLocation
      : [11.0168, 76.9558]
  );
  const [destCoords, setDestCoords] = useState<[number, number]>([11.0085, 76.951]);
  const [destLabel, setDestLabel] = useState<string>('RS Puram');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pinMode, setPinMode] = useState<'start' | 'end'>('end');
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [isTrackingArrow, setIsTrackingArrow] = useState<boolean>(false);
  const [navStepIdx, setNavStepIdx] = useState<number>(0);
  const [navPos, setNavPos] = useState<[number, number]>(activeCoords);
  const [navBearing, setNavBearing] = useState<number>(
    calculateBearing(activeCoords, [11.0085, 76.951])
  );

  const [safetyData, setSafetyData] = useState<any>(null);
  const [address, setAddress] = useState<string>('Coimbatore');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locatingGps, setLocatingGps] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');

  const currentDistrict = resolveTamilNaduDistrict(activeCoords[0], activeCoords[1]);

  const loadDashboard = useCallback(
    async (lat: number, lng: number, dLat = destCoords[0], dLng = destCoords[1]) => {
      if (!isCoordinateInTamilNadu(lat, lng)) return;
      setLoading(true);
      try {
        const [scoreRes, geoRes, radarRes, profRes, routeRes] = await Promise.all([
          api.getSafetyScore(lat, lng),
          api.reverseGeocode(lat, lng),
          api.getLiveRadar(lat, lng, 7000, false),
          api.getUserProfile(),
          api.analyzeRoutes({ lat, lng }, { lat: dLat, lng: dLng }, 'car')
        ]);

        setSafetyData(scoreRes);
        if (geoRes?.address) {
          setAddress(geoRes.address.split(',').slice(0, 2).join(',').trim());
        }
        setIncidents(radarRes.observations || []);
        setFacilities(radarRes.facilities || []);
        setWeather(radarRes.weather || null);
        setProfile(profRes);
        if (routeRes?.routes && routeRes.routes.length > 0) {
          setRoutes(routeRes.routes);
          setSelectedRouteId(routeRes.recommendedRouteId || routeRes.routes[0].id);
        }
      } catch (e) {
        console.error('Dashboard load error', e);
      } finally {
        setLoading(false);
      }
    },
    [destCoords]
  );

  useEffect(() => {
    loadDashboard(activeCoords[0], activeCoords[1], destCoords[0], destCoords[1]);
  }, [activeCoords, destCoords, loadDashboard]);

  const activeRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

  useEffect(() => {
    if (activeRoute && activeRoute.coordinates.length >= 2) {
      const coords = activeRoute.coordinates;
      setNavStepIdx(0);
      setNavPos(coords[0]);
      const nextPt =
        coords.find(
          pt =>
            Math.abs(pt[0] - coords[0][0]) > 0.00003 ||
            Math.abs(pt[1] - coords[0][1]) > 0.00003
        ) || coords[1];
      setNavBearing(calculateBearing(coords[0], nextPt));
    } else {
      setNavPos(activeCoords);
      setNavBearing(calculateBearing(activeCoords, destCoords));
    }
  }, [selectedRouteId, routes, activeCoords, destCoords]);

  useEffect(() => {
    if (!isTrackingArrow || !activeRoute || activeRoute.coordinates.length < 2) return;
    const coords = activeRoute.coordinates;
    const timer = setInterval(() => {
      setNavStepIdx(prev => {
        const next = prev + 1;
        if (next >= coords.length) {
          setIsTrackingArrow(false);
          return coords.length - 1;
        }
        const currPt = coords[prev];
        const nextPt = coords[next];
        if (
          Math.abs(nextPt[0] - currPt[0]) > 0.00001 ||
          Math.abs(nextPt[1] - currPt[1]) > 0.00001
        ) {
          setNavBearing(calculateBearing(currPt, nextPt));
        }
        setNavPos(nextPt);
        return next;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [isTrackingArrow, activeRoute]);

  const handleUseCurrentLocation = () => {
    setLocatingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLocatingGps(false);
          if (isCoordinateInTamilNadu(pos.coords.latitude, pos.coords.longitude)) {
            setActiveCoords([pos.coords.latitude, pos.coords.longitude]);
          }
        },
        () => setLocatingGps(false),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setLocatingGps(false);
    }
  };

  const handleUpdateStartPin = (lat: number, lng: number) => {
    if (!isCoordinateInTamilNadu(lat, lng)) return;
    setActiveCoords([lat, lng]);
  };

  const handleUpdateDestPin = (lat: number, lng: number, customName?: string) => {
    if (!isCoordinateInTamilNadu(lat, lng)) return;
    setDestCoords([lat, lng]);
    if (customName) {
      setDestLabel(customName);
    } else {
      setDestLabel(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
      api
        .reverseGeocode(lat, lng)
        .then(geo => {
          if (geo?.address) {
            setDestLabel(geo.address.split(',').slice(0, 2).join(',').trim());
          }
        })
        .catch(() => {});
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;
    try {
      const res = await api.addEmergencyContact({
        name: contactName,
        phone: contactPhone,
        relation: contactRelation || 'Trusted Contact'
      });
      if (res.contacts && profile) {
        setProfile({ ...profile, emergencyContacts: res.contacts });
        setContactName('');
        setContactPhone('');
        setContactRelation('');
      }
    } catch (err) {
      console.error('Failed to add contact', err);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const res = await api.deleteEmergencyContact(id);
      if (res.contacts && profile) {
        setProfile({ ...profile, emergencyContacts: res.contacts });
      }
    } catch (err) {
      console.error('Failed to delete contact', err);
    }
  };

  const riskLevel = safetyData?.riskLevel || 'LOW';
  const riskColorClass =
    riskLevel === 'HIGH' || riskLevel === 'CRITICAL'
      ? 'text-[#EF4444]'
      : riskLevel === 'MODERATE'
      ? 'text-[#F59E0B]'
      : 'text-[#22C55E]';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent text-[#FAFAFA] p-3 sm:p-5">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Clean Top Control Bar */}
        <div className="luxury-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Safe Corridors</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#FFD43B] font-mono">
                {currentDistrict.name}
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              {address} → {destLabel}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
            <div className="flex-1">
              <LocationAutocompleteInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search any destination in Tamil Nadu..."
                onUseGps={handleUseCurrentLocation}
                locatingGps={locatingGps}
                onSelect={place => {
                  handleUpdateDestPin(place.lat, place.lng, place.name);
                }}
              />
            </div>

            <select
              value={currentDistrict.id}
              onChange={e => {
                const d = TAMIL_NADU_DISTRICTS.find(item => item.id === e.target.value);
                if (d) {
                  setActiveCoords([d.lat, d.lng]);
                  setDestCoords([d.lat + 0.012, d.lng + 0.012]);
                  setDestLabel(`${d.name} Center`);
                }
              }}
              className="bg-[#111114] border border-[#303036] rounded-xl px-3 py-2.5 text-xs text-[#FAFAFA] focus:outline-none"
            >
              {TAMIL_NADU_DISTRICTS.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <button
              onClick={onTriggerSOS}
              className="px-4 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#FF334F] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer shrink-0"
            >
              <AlertTriangle className="w-4 h-4" /> SOS
            </button>
          </div>
        </div>

        {/* 4 Concise Live Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="luxury-card p-4">
            <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
              <span>Safety Score</span>
              <BarChart3 className="w-4 h-4 text-[#E11D48]" />
            </div>
            <div className={`text-2xl font-bold font-mono mt-1 ${riskColorClass}`}>
              {loading ? '--' : `${safetyData?.safetyScore ?? 88}%`}
            </div>
            <div className="text-[11px] text-[#A1A1AA]">{riskLevel} RISK</div>
          </div>

          <Link to="/heatmap" className="luxury-card luxury-card-hover p-4 block">
            <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
              <span>Safe Havens</span>
              <Radio className="w-4 h-4 text-[#22C55E]" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {loading ? '--' : facilities.length}
            </div>
            <div className="text-[11px] text-[#22C55E]">Police & Hospitals →</div>
          </Link>

          <Link to="/routes" className="luxury-card luxury-card-hover p-4 block">
            <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
              <span>Weather</span>
              <CloudRain className="w-4 h-4 text-[#168BFF]" />
            </div>
            <div className="text-base font-bold text-white mt-1 truncate">
              {weather?.conditionText || 'Clear'}
            </div>
            <div className="text-[11px] text-[#A1A1AA]">
              {weather?.temperatureC !== null && weather?.temperatureC !== undefined
                ? `${weather.temperatureC}°C`
                : 'Live Feed'}
            </div>
          </Link>

          <div className="luxury-card p-4">
            <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
              <span>Police Helpline</span>
              <Phone className="w-4 h-4 text-[#FFD43B]" />
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1 truncate">
              {currentDistrict.policeControlPhone.split('/')[0]}
            </div>
            <a
              href={`tel:${currentDistrict.policeControlPhone.split('/')[0].trim()}`}
              className="inline-block mt-1 text-[11px] font-bold text-[#FF334F]"
            >
              Call Control →
            </a>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-4">
            <div className="luxury-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#E11D48]" /> Live Corridor Map
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeRoute && navStepIdx >= activeRoute.coordinates.length - 1) {
                        setNavStepIdx(0);
                        setNavPos(activeRoute.coordinates[0]);
                      }
                      setIsTrackingArrow(prev => !prev);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#111114] border border-[#303036] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    {isTrackingArrow ? (
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
                    onClick={handleUseCurrentLocation}
                    className="px-3 py-1.5 rounded-lg bg-[#111114] border border-[#303036] text-xs text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-[#168BFF]" /> GPS
                  </button>
                  <Link
                    to="/routes"
                    className="px-3 py-1.5 rounded-lg bg-[#E11D48] text-white text-xs font-bold"
                  >
                    Route Planner →
                  </Link>
                </div>
              </div>

              <div className="h-[480px] w-full">
                <MapComponent
                  center={isTrackingArrow ? navPos : activeCoords}
                  zoom={14}
                  routes={routes}
                  selectedRouteId={selectedRouteId}
                  incidents={incidents}
                  facilities={facilities}
                  startCoords={activeCoords}
                  endCoords={destCoords}
                  startLabel={address.split(',')[0] || 'Start'}
                  endLabel={destLabel}
                  navigationPosition={navPos}
                  navigationBearing={navBearing}
                  pinSelectionMode={pinMode}
                  onPinSelectionModeChange={setPinMode}
                  onStartDragEnd={(lat, lng) => handleUpdateStartPin(lat, lng)}
                  onEndDragEnd={(lat, lng) => handleUpdateDestPin(lat, lng)}
                  onMapClick={(lat, lng, mode) => {
                    if ((mode || pinMode) === 'start') {
                      handleUpdateStartPin(lat, lng);
                    } else {
                      handleUpdateDestPin(lat, lng);
                    }
                  }}
                />
              </div>
            </div>

            {/* Nearby Safe Havens */}
            <div className="luxury-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> Nearest Safe Havens (Tap to Route)
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {facilities.slice(0, 6).map(fac => (
                  <div
                    key={fac.id}
                    onClick={() => handleUpdateDestPin(fac.lat, fac.lng, fac.name)}
                    className="p-3 rounded-xl bg-[#111114] border border-[#303036] hover:border-[#22C55E]/60 transition-all flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#18181B] border border-[#303036] text-[#FFD43B]">
                          {fac.type}
                        </span>
                        <span className="text-xs font-bold text-white truncate">{fac.name}</span>
                      </div>
                      {typeof fac.distanceMeters === 'number' && (
                        <div className="text-[10px] font-mono text-[#22C55E] mt-0.5">
                          {(fac.distanceMeters / 1000).toFixed(1)} km away
                        </div>
                      )}
                    </div>
                    <a
                      href={`tel:${fac.phone.split('/')[0].trim()}`}
                      onClick={e => e.stopPropagation()}
                      className="px-2.5 py-1.5 rounded-lg bg-[#E11D48] text-white font-bold text-xs shrink-0"
                    >
                      Call
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Guardian Circle & AI Assistant */}
          <div className="lg:col-span-4 space-y-4">
            <div className="luxury-card p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E11D48]" /> Guardian Circle
                </h2>
                <span className="text-[11px] text-[#A1A1AA]">
                  {profile?.emergencyContacts?.length || 0} Contacts
                </span>
              </div>

              <div className="space-y-2">
                {profile?.emergencyContacts?.map(c => (
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
                        href={`tel:${c.phone}`}
                        className="px-2.5 py-1 rounded-lg bg-[#E11D48] text-white font-bold text-xs flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> Call
                      </a>
                      <button
                        onClick={() => handleDeleteContact(c.id)}
                        className="p-1.5 rounded-lg bg-[#18181B] text-[#A1A1AA] hover:text-[#EF4444] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddContact} className="pt-3 border-t border-[#303036] space-y-2">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[#E11D48]" /> Add Contact
                </div>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Name"
                  required
                  className="w-full bg-[#111114] border border-[#303036] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="Phone (+91...)"
                    required
                    className="bg-[#111114] border border-[#303036] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={contactRelation}
                    onChange={e => setContactRelation(e.target.value)}
                    placeholder="Relation"
                    className="bg-[#111114] border border-[#303036] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-[#E11D48] hover:bg-[#FF334F] text-white font-bold text-xs cursor-pointer"
                >
                  Save Contact
                </button>
              </form>
            </div>

            <BatteryConnectivityGuardian
              coords={activeCoords}
              contacts={profile?.emergencyContacts || []}
              onTriggerSOS={onTriggerSOS}
            />

            <div className="luxury-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#111114] border border-[#303036] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-[#E11D48]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Safety Assistant</h3>
                  <p className="text-xs text-[#A1A1AA]">Voice companion & emergency help</p>
                </div>
              </div>
              <Link
                to="/assistant"
                className="block w-full py-2.5 rounded-xl bg-[#111114] hover:bg-[#18181B] border border-[#303036] text-center text-xs font-bold text-white"
              >
                Open Assistant →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
