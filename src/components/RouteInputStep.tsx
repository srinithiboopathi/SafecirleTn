import React from 'react';
import {
  Search,
  MapPin,
  ArrowUpDown,
  RotateCcw,
  Navigation,
  Loader2,
  WifiOff,
  Plus,
  X,
  Footprints,
  Bike,
  Car
} from 'lucide-react';
import { TravelMode } from '../types';
import { computeModeDurationSeconds, formatDuration, formatDistance } from '../utils/geoUtils';

export interface RoutePoint {
  id: string;
  query: string;
  coords: [number, number] | null;
  role: 'start' | 'waypoint' | 'dest';
  suggestions: any[];
  isSearching: boolean;
}

export interface RouteInputStepProps {
  points: RoutePoint[];
  onUpdatePoint: (id: string, updates: Partial<RoutePoint>) => void;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
  onUseCurrentLocation: () => void;
  onSetClickMode: (pointId: string | null) => void;
  clickMode: string | null; // pointId or null
  onSwap: () => void;
  onClear: () => void;
  onCalculate: () => void;
  loading: boolean;
  onPresetSelect: (name: string, coords: [number, number]) => void;
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  activeDistanceMeters?: number;
}

const COIMBATORE_PRESETS = [
  { name: 'Gandhipuram Bus Stand', coords: [11.0168, 76.9678] as [number, number] },
  { name: 'RS Puram DB Road', coords: [11.0112, 76.9458] as [number, number] },
  { name: 'Peelamedu Tech Park', coords: [11.0285, 77.0270] as [number, number] },
];

export const RouteInputStep: React.FC<RouteInputStepProps> = ({
  points,
  onUpdatePoint,
  onAddWaypoint,
  onRemoveWaypoint,
  onUseCurrentLocation,
  onSetClickMode,
  clickMode,
  onSwap,
  onClear,
  onCalculate,
  loading,
  onPresetSelect,
  travelMode,
  onTravelModeChange,
  activeDistanceMeters
}) => {
  const modeOptions: { id: TravelMode; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      id: 'walking',
      label: 'Walk',
      sublabel: activeDistanceMeters
        ? formatDuration(computeModeDurationSeconds(activeDistanceMeters, 'walking', 0))
        : '~5 km/h',
      icon: <Footprints className="w-4 h-4" />
    },
    {
      id: 'biking',
      label: 'Bike',
      sublabel: activeDistanceMeters
        ? formatDuration(computeModeDurationSeconds(activeDistanceMeters, 'biking', 0))
        : '~20 km/h',
      icon: <Bike className="w-4 h-4" />
    },
    {
      id: 'driving',
      label: 'Car',
      sublabel: activeDistanceMeters
        ? formatDuration(computeModeDurationSeconds(activeDistanceMeters, 'driving', 0))
        : '~35 km/h',
      icon: <Car className="w-4 h-4" />
    }
  ];

  return (
    <div className="p-5 border-b border-white/10 space-y-3.5 bg-[#17181c]/50">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-2">
            <span>Route Intelligence</span>
            {activeDistanceMeters && activeDistanceMeters > 0 ? (
              <span className="text-[#30d158] font-bold">· {formatDistance(activeDistanceMeters)}</span>
            ) : null}
          </div>
          <h2 className="text-lg font-semibold text-[#f5f5f7] tracking-tight">
            Plan Safe Route
          </h2>
        </div>
        <button
          onClick={onAddWaypoint}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0a84ff]/10 hover:bg-[#0a84ff]/20 text-[#64b5ff] border border-[#0a84ff]/20 rounded-xl text-[11px] font-bold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Stop</span>
        </button>
      </div>

      {/* Prominent Walk / Bike / Car Mode Selector (Google Maps Style) */}
      <div className="grid grid-cols-3 gap-2 bg-[#101114] p-1.5 rounded-2xl border border-white/10">
        {modeOptions.map((m) => {
          const isActive = travelMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onTravelModeChange(m.id)}
              className={`flex items-center justify-center space-x-2 py-2 px-2.5 rounded-xl text-xs transition-all ${
                isActive
                  ? 'bg-[#0a84ff] text-white font-bold shadow-lg shadow-[#0a84ff]/30 ring-1 ring-white/20'
                  : 'text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-white/5 font-medium'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-[#64b5ff]'}>{m.icon}</span>
              <div className="text-left leading-tight">
                <div className="text-xs font-bold">{m.label}</div>
                <div className={`text-[10px] ${isActive ? 'text-blue-100 font-semibold' : 'text-[#a1a1aa]'}`}>
                  {m.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
          Quick Landmarks:
        </span>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {COIMBATORE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onPresetSelect(preset.name, preset.coords)}
              className="px-2.5 py-1 bg-[#17181c] hover:bg-white/10 text-[#a1a1aa] hover:text-[#f5f5f7] rounded-lg text-[11px] font-medium border border-white/5 transition"
            >
              {preset.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 relative">
        {points.map((p, idx) => (
          <div key={p.id} className="relative group">
            <div className={`flex items-center bg-[#17181c] border rounded-xl px-3 py-2 text-xs transition-all ${clickMode === p.id ? 'border-[#0a84ff] ring-2 ring-[#0a84ff]/20' : 'border-white/10 focus-within:border-[#0a84ff]'}`}>
              <div className="flex flex-col items-center mr-2 shrink-0">
                <span className={`w-4 h-4 rounded-full text-white flex items-center justify-center font-bold text-[9px] ${
                  p.role === 'start' ? 'bg-[#0a84ff]' : p.role === 'dest' ? 'bg-[#ff453a]' : 'bg-[#a1a1aa]'
                }`}>
                  {p.role === 'start' ? 'A' : p.role === 'dest' ? 'B' : idx}
                </span>
                {idx < points.length - 1 && (
                  <div className="w-px h-2 bg-white/10 my-0.5"></div>
                )}
              </div>

              <input
                type="text"
                placeholder={p.role === 'start' ? "Starting location..." : p.role === 'dest' ? "Destination..." : "Stop location..."}
                value={p.query}
                onChange={(e) => onUpdatePoint(p.id, { query: e.target.value })}
                className="w-full text-xs text-[#f5f5f7] placeholder-[#a1a1aa]/60 bg-transparent focus:outline-hidden"
              />
              
              <div className="flex items-center space-x-1.5 ml-1">
                {p.role === 'start' && (
                  <button
                    type="button"
                    onClick={onUseCurrentLocation}
                    className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-[#0a84ff]/20 hover:bg-[#0a84ff]/30 text-[#64b5ff] text-[10px] font-bold shrink-0 transition"
                    title="Use Your Real GPS Location"
                  >
                    <Navigation className="w-3 h-3 fill-[#64b5ff]" />
                    <span>Your Location</span>
                  </button>
                )}
                
                <button
                  onClick={() => onSetClickMode(clickMode === p.id ? null : p.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 transition ${
                    clickMode === p.id ? 'bg-[#0a84ff] text-white' : 'bg-white/5 text-[#a1a1aa]'
                  }`}
                  title="Pin on Map"
                >
                  Pin
                </button>

                {p.role === 'waypoint' && (
                  <button
                    onClick={() => onRemoveWaypoint(p.id)}
                    className="p-1 text-[#a1a1aa] hover:text-[#ff453a] transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Suggestions Dropdown */}
            {p.suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#17181c] border border-white/10 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] z-[60] max-h-48 overflow-y-auto">
                {p.suggestions.map((s, sIdx) => (
                  <button 
                    key={sIdx} 
                    onClick={() => onUpdatePoint(p.id, { query: s.displayName, coords: [s.lat, s.lng], suggestions: [] })} 
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition flex items-start space-x-2"
                  >
                    <MapPin className="w-3 h-3 mt-0.5 text-[#a1a1aa]" />
                    <div className="font-medium text-[#f5f5f7] truncate">{s.displayName}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center space-x-1">
          <button 
            onClick={onSwap} 
            disabled={points.length > 2}
            className="p-2 bg-[#17181c] border border-white/10 rounded-xl text-xs transition disabled:opacity-30" 
            title="Swap Start/End (2 points only)"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClear} className="p-2 bg-[#17181c] border border-white/10 rounded-xl text-xs transition"><RotateCcw className="w-3.5 h-3.5" /></button>
        </div>
        <button
          onClick={onCalculate}
          disabled={loading || points.some(p => !p.coords)}
          className="flex-1 flex items-center justify-center space-x-2 bg-[#0a84ff] hover:bg-[#0077ed] disabled:bg-[#17181c] text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-[#0a84ff]/20 active:scale-95"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Analyze {points.length}-Point Route</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
