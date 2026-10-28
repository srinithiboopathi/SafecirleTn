import React, { useState } from 'react';
import {
  MapPin,
  Search,
  Navigation,
  Crosshair,
  Compass,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Globe
} from 'lucide-react';
import { api } from '../services/api';
import { GpsConnectionStatus, LocationSource } from '../hooks/useRealtimeGps';
import { formatAccuracy } from '../utils/geoUtils';

interface SetLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoords: [number, number] | null;
  status: GpsConnectionStatus;
  accuracy: number | null;
  errorMessage: string | null;
  locationSource: LocationSource;
  locationLabel: string | null;
  onSelectCoords: (coords: [number, number], label: string) => void;
  onRetryGps: () => void;
  onEnableMapPinMode: () => void;
}

const COMMON_CITIES = [
  { name: 'Coimbatore, Tamil Nadu', coords: [11.0168, 76.9558] as [number, number] },
  { name: 'Chennai, Tamil Nadu', coords: [13.0827, 80.2707] as [number, number] },
  { name: 'Bengaluru, Karnataka', coords: [12.9716, 77.5946] as [number, number] },
  { name: 'Mumbai, Maharashtra', coords: [19.0760, 72.8777] as [number, number] },
  { name: 'Delhi NCR', coords: [28.6139, 77.2090] as [number, number] },
  { name: 'Hyderabad, Telangana', coords: [17.3850, 78.4867] as [number, number] },
];

export const SetLocationModal: React.FC<SetLocationModalProps> = ({
  isOpen,
  onClose,
  currentCoords,
  status,
  accuracy,
  errorMessage,
  locationSource,
  locationLabel,
  onSelectCoords,
  onRetryGps,
  onEnableMapPinMode
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<{ displayName: string; lat: number; lng: number }[]>([]);
  const [isRetryingGps, setIsRetryingGps] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const data = await api.geocode(searchQuery.trim());
      setResults(data || []);
    } catch (err) {
      console.error('Location search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (item: { displayName: string; lat: number; lng: number }) => {
    const short = item.displayName.split(',').slice(0, 3).join(',');
    onSelectCoords([item.lat, item.lng], short.trim());
    onClose();
  };

  const handleRetryDeviceGps = async () => {
    setIsRetryingGps(true);
    try {
      onRetryGps();
      setTimeout(() => {
        setIsRetryingGps(false);
      }, 1500);
    } catch {
      setIsRetryingGps(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#121316] border border-white/20 rounded-3xl p-6 shadow-2xl text-[#f5f5f7] space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0a84ff]/20 text-[#64b5ff] border border-[#0a84ff]/30 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Set Your Exact Location
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Ensure precise turn-by-turn navigation and corridor safety tracking
            </p>
          </div>
        </div>

        {/* Current Location Status Card */}
        <div className="bg-[#17181c] border border-white/10 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#a1a1aa] font-medium">Currently Detected:</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#64b5ff]">
              {locationSource === 'gps' && '🛰️ Satellite GPS'}
              {locationSource === 'network' && '📶 Wi-Fi / Cell'}
              {locationSource === 'ip' && '🌐 City IP Lookup'}
              {locationSource === 'manual' && '📍 Custom Pinned'}
              {(!locationSource || locationSource === 'simulated') && 'Searching...'}
            </span>
          </div>

          <div className="font-mono text-[13px] text-white font-semibold">
            {currentCoords
              ? `${currentCoords[0].toFixed(5)}° N, ${currentCoords[1].toFixed(5)}° E`
              : 'Acquiring coordinates...'}
          </div>

          {locationLabel && (
            <div className="text-[#a1a1aa] text-[11px] truncate">
              Area: <span className="text-white font-medium">{locationLabel}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-[#a1a1aa]">
            <span>Accuracy: {formatAccuracy(accuracy)}</span>
            <button
              type="button"
              onClick={handleRetryDeviceGps}
              disabled={isRetryingGps}
              className="flex items-center space-x-1 text-[#64b5ff] hover:text-white font-bold transition"
            >
              <RefreshCw className={`w-3 h-3 ${isRetryingGps ? 'animate-spin' : ''}`} />
              <span>Re-check GPS</span>
            </button>
          </div>

          {errorMessage && (
            <div className="text-[11px] text-[#ff453a] bg-red-500/10 p-2 rounded-xl flex items-start space-x-1.5 mt-1 border border-red-500/20">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Method 1: Search Exact Address */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#f5f5f7] block">
            1. Search by City, Street or Landmark
          </label>
          <form onSubmit={handleSearch} className="relative flex items-center">
            <input
              type="text"
              placeholder="e.g., Koramangala Bangalore, RS Puram, Times Square..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#17181c] border border-white/15 focus:border-[#0a84ff] rounded-2xl py-2.5 pl-9 pr-20 text-xs text-white placeholder-[#86868b] focus:outline-hidden transition"
            />
            <Search className="w-4 h-4 text-[#86868b] absolute left-3 pointer-events-none" />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1.5 px-3 py-1.5 bg-[#0a84ff] hover:bg-[#0077ed] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Search</span>}
            </button>
          </form>

          {/* Search Results */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto bg-[#17181c] border border-white/10 rounded-2xl p-1">
              {results.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectResult(res)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition flex items-start space-x-2 text-xs"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#30d158] shrink-0 mt-0.5" />
                  <span className="text-[#f5f5f7] truncate">{res.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Method 2: Click on Map */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#f5f5f7] block">
            2. Or Pin Directly on the Map
          </label>
          <button
            type="button"
            onClick={() => {
              onEnableMapPinMode();
              onClose();
            }}
            className="w-full py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl text-xs font-semibold text-white flex items-center justify-center space-x-2 transition"
          >
            <Crosshair className="w-4 h-4 text-[#0a84ff]" />
            <span>Tap Map to Place Your Location Puck</span>
          </button>
        </div>

        {/* Method 3: Quick Popular Cities */}
        <div className="space-y-2 pt-1 border-t border-white/10">
          <label className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider block">
            Quick Cities
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => {
                  onSelectCoords(city.coords, city.name);
                  onClose();
                }}
                className="px-2.5 py-1 bg-[#17181c] hover:bg-white/10 border border-white/10 rounded-xl text-[11px] text-[#f5f5f7] font-medium transition"
              >
                {city.name.split(',')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
