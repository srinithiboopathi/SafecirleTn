import React, { useEffect, useState, useCallback } from 'react';
import { MapComponent } from '../components/MapComponent';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput';
import { api } from '../services/api';
import { Incident, EmergencyFacility } from '../types';
import {
  TAMIL_NADU_DISTRICTS,
  isCoordinateInTamilNadu,
  resolveTamilNaduDistrict
} from '../utils/tamilNaduGeo';
import {
  Radio,
  Clock,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  CloudRain,
  Building2,
  PhoneCall,
  X
} from 'lucide-react';

export const HeatmapPage: React.FC<{ userLocation: [number, number] }> = ({ userLocation }) => {
  const [selectedCenter, setSelectedCenter] = useState<[number, number]>(() =>
    isCoordinateInTamilNadu(userLocation[0], userLocation[1])
      ? userLocation
      : [11.0168, 76.9558]
  );
  const [outOfBoundsNotice, setOutOfBoundsNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [observations, setObservations] = useState<Incident[]>([]);
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [weatherMeta, setWeatherMeta] = useState<any>(null);
  const [districtInfo, setDistrictInfo] = useState(() =>
    resolveTamilNaduDistrict(selectedCenter[0], selectedCenter[1])
  );

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [includeDemo, setIncludeDemo] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const loadRadarData = useCallback(async (lat: number, lng: number, demoMode: boolean) => {
    if (!isCoordinateInTamilNadu(lat, lng)) {
      setOutOfBoundsNotice('Please select a location inside Tamil Nadu.');
      return;
    }

    setLoading(true);
    setOutOfBoundsNotice(null);
    setDistrictInfo(resolveTamilNaduDistrict(lat, lng));

    try {
      const data = await api.getLiveRadar(lat, lng, 8000, demoMode);
      if (data.outOfBounds) {
        setOutOfBoundsNotice('Selected location is outside Tamil Nadu.');
        setObservations([]);
        setFacilities([]);
      } else {
        setObservations(data.observations || []);
        setFacilities(data.facilities || []);
        setWeatherMeta(data.weather || null);
        if (data.district) setDistrictInfo(data.district);
      }
    } catch (e) {
      console.error('Failed to load Threat Radar data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRadarData(selectedCenter[0], selectedCenter[1], includeDemo);
  }, [selectedCenter, includeDemo, loadRadarData]);

  const handleDistrictSelect = (districtId: string) => {
    const found = TAMIL_NADU_DISTRICTS.find(d => d.id === districtId);
    if (found) {
      setOutOfBoundsNotice(null);
      setSearchQuery(found.name);
      setSelectedCenter([found.lat, found.lng]);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!isCoordinateInTamilNadu(lat, lng)) {
      setOutOfBoundsNotice('Please tap inside Tamil Nadu.');
      return;
    }
    setOutOfBoundsNotice(null);
    setSelectedCenter([lat, lng]);
  };

  const filteredObservations = observations.filter(obs => {
    if (filterType !== 'all' && obs.type !== filterType) return false;
    return true;
  });

  const dynamicHeatmapPoints = filteredObservations.map(obs => ({
    lat: obs.lat,
    lng: obs.lng,
    weight: obs.severity / 5,
    type: obs.type,
    title: obs.title,
    sourceName: obs.sourceName || obs.source,
    verificationStatus: obs.verificationStatus
  }));

  const getBadgeStyle = (status?: string, isDemo?: boolean) => {
    if (isDemo || status === 'demo') {
      return { text: 'DEMO', cls: 'bg-purple-950/70 text-purple-300 border-purple-500/40' };
    }
    if (status === 'verified_external') {
      return { text: 'LIVE FEED', cls: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40' };
    }
    return { text: 'COMMUNITY', cls: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40' };
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent text-[#FAFAFA] p-3 sm:p-5">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Compact Top Bar with Google Maps-Style Location Search */}
        <div className="luxury-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E11D48]/15 border border-[#E11D48]/40 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-[#E11D48]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Threat Radar</h1>
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#FFD43B] font-mono">
                  {districtInfo.name}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Live street lighting, road alerts, weather & safe havens
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
            <div className="flex-1">
              <LocationAutocompleteInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search any town, street, or landmark in Tamil Nadu..."
                onSelect={place => {
                  setOutOfBoundsNotice(null);
                  setSelectedCenter([place.lat, place.lng]);
                }}
              />
            </div>

            <select
              value={districtInfo.id}
              onChange={e => handleDistrictSelect(e.target.value)}
              className="bg-[#111114] border border-[#303036] rounded-xl px-3 py-2.5 text-xs text-[#FAFAFA] focus:outline-none"
            >
              {TAMIL_NADU_DISTRICTS.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => loadRadarData(selectedCenter[0], selectedCenter[1], includeDemo)}
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl bg-[#111114] hover:bg-[#18181B] border border-[#303036] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E11D48] ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {outOfBoundsNotice && (
          <div className="p-3 rounded-xl bg-[#18181B] border border-[#EF4444]/60 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 text-[#FF334F]">
              <AlertTriangle className="w-4 h-4" />
              {outOfBoundsNotice}
            </span>
            <button onClick={() => setOutOfBoundsNotice(null)} className="text-[#A1A1AA]">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel: Quick Filters + Live Alerts */}
          <div className="lg:col-span-4 space-y-4 flex flex-col max-h-[760px]">
            <div className="luxury-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex bg-[#111114] p-1 rounded-lg border border-[#303036]">
                  <button
                    onClick={() => setShowHeatmap(true)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      showHeatmap ? 'bg-[#E11D48] text-white' : 'text-[#A1A1AA]'
                    }`}
                  >
                    Heatmap
                  </button>
                  <button
                    onClick={() => setShowHeatmap(false)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      !showHeatmap ? 'bg-[#E11D48] text-white' : 'text-[#A1A1AA]'
                    }`}
                  >
                    Pins
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#A1A1AA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDemo}
                    onChange={e => setIncludeDemo(e.target.checked)}
                    className="accent-[#E11D48]"
                  />
                  <span>Demo Data</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'lighting', label: 'Unlit Roads' },
                  { id: 'infrastructure', label: 'Road Work' },
                  { id: 'weather_hazard', label: 'Weather' },
                  { id: 'harassment', label: 'Reports' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterType(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      filterType === cat.id
                        ? 'bg-[#E11D48] border-[#E11D48] text-white'
                        : 'bg-[#111114] border-[#303036] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Compact Weather & Police Status */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-lg bg-[#111114] border border-[#303036]">
                  <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1">
                    <CloudRain className="w-3 h-3 text-[#168BFF]" /> Weather
                  </div>
                  <div className="font-semibold text-white truncate mt-0.5">
                    {weatherMeta?.conditionText || 'Clear'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#111114] border border-[#303036]">
                  <div className="text-[10px] text-[#A1A1AA]">Police Control</div>
                  <div className="font-mono font-bold text-[#22C55E] mt-0.5">
                    {districtInfo.policeControlPhone.split('/')[0]}
                  </div>
                </div>
              </div>
            </div>

            {/* Observations List */}
            <div className="luxury-card p-4 flex-1 overflow-y-auto space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#303036]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Active Alerts ({filteredObservations.length})
                </h3>
                <span className="text-[10px] font-mono text-[#22C55E]">Live</span>
              </div>

              {loading ? (
                <div className="py-10 text-center text-xs text-[#A1A1AA]">Scanning area...</div>
              ) : filteredObservations.length === 0 ? (
                <div className="p-5 rounded-xl bg-[#111114] border border-[#303036] text-center space-y-1.5">
                  <CheckCircle2 className="w-6 h-6 text-[#22C55E] mx-auto" />
                  <div className="text-xs font-semibold text-white">Area Clear</div>
                  <p className="text-[11px] text-[#A1A1AA]">
                    No active lighting or weather hazards in this radius.
                  </p>
                </div>
              ) : (
                filteredObservations.map(obs => {
                  const badge = getBadgeStyle(obs.verificationStatus, obs.isDemo);
                  return (
                    <div
                      key={obs.id}
                      onClick={() => setSelectedCenter([obs.lat, obs.lng])}
                      className="p-3 rounded-xl bg-[#111114] border border-[#303036] hover:border-[#E11D48]/60 transition-all cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${badge.cls}`}
                        >
                          {badge.text}
                        </span>
                        <span className="text-[10px] font-mono text-[#A1A1AA] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(obs.timestamp).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white">
                        {obs.title || obs.categoryLabel || obs.type.toUpperCase()}
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] line-clamp-2">{obs.description}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Map + Nearby Safe Havens */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="h-[500px] w-full relative">
              <MapComponent
                center={selectedCenter}
                zoom={14}
                incidents={filteredObservations}
                facilities={facilities}
                showHeatmap={showHeatmap}
                heatmapPoints={dynamicHeatmapPoints}
                onMapClick={handleMapClick}
              />
            </div>

            <div className="luxury-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#22C55E]" /> Nearby Police & 24/7 Hospitals (
                  {facilities.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto">
                {facilities.slice(0, 6).map(fac => (
                  <div
                    key={fac.id}
                    onClick={() => setSelectedCenter([fac.lat, fac.lng])}
                    className="p-3 rounded-xl bg-[#111114] border border-[#303036] hover:border-white/25 transition-all flex items-center justify-between gap-2 cursor-pointer"
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
                          {(fac.distanceMeters / 1000).toFixed(1)} km • {fac.phone}
                        </div>
                      )}
                    </div>
                    <a
                      href={`tel:${fac.phone.split('/')[0].trim()}`}
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#FF334F] text-white font-bold text-xs flex items-center gap-1"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>Call</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
