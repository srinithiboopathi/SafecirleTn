import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, Crosshair, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import {
  searchLocalTamilNaduPlaces,
  TamilNaduPlaceSuggestion
} from '../utils/tamilNaduGeo';

export interface LocationSelection {
  name: string;
  displayName: string;
  subtitle?: string;
  lat: number;
  lng: number;
}

interface LocationAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (place: LocationSelection) => void;
  onClear?: () => void;
  onUseGps?: () => void;
  locatingGps?: boolean;
  placeholder?: string;
  badgeText?: string;
  badgeColor?: string;
  activeBorderColor?: string;
  isActive?: boolean;
  onFocusInput?: () => void;
}

export const LocationAutocompleteInput: React.FC<LocationAutocompleteInputProps> = ({
  value,
  onChange,
  onSelect,
  onClear,
  onUseGps,
  locatingGps = false,
  placeholder = 'Search any location, street, or landmark...',
  badgeText,
  badgeColor = '#168BFF',
  isActive = false,
  onFocusInput
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TamilNaduPlaceSuggestion[]>(() =>
    searchLocalTamilNaduPlaces('', 6)
  );
  const [highlightIdx, setHighlightIdx] = useState<number>(-1);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<any>(null);
  const suppressNextSearchRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    const q = value.trim();
    // Instant 0ms local matches
    const local = searchLocalTamilNaduPlaces(q, 6);
    setSuggestions(local);
    setHighlightIdx(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const remote = await api.searchLocation(q);
        if (Array.isArray(remote) && remote.length > 0) {
          const normalized: TamilNaduPlaceSuggestion[] = remote.map((r: any) => {
            const rawName = r.name || r.displayName || q;
            const parts = String(r.displayName || rawName)
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            const primary =
              r.name && !r.name.includes(',') ? r.name : parts[0] || rawName;
            const sub =
              r.subtitle ||
              parts.slice(1, 3).join(', ') ||
              (r.district ? `${r.district}, Tamil Nadu` : 'Tamil Nadu');
            return {
              name: primary,
              displayName: r.displayName || `${primary}, ${sub}`,
              subtitle: sub,
              lat: Number(r.lat),
              lng: Number(r.lng),
              district: r.district || 'Tamil Nadu',
              type: r.type || 'Place'
            };
          });

          // Merge local + remote without duplicates
          const merged = [...local];
          for (const item of normalized) {
            const dup = merged.some(
              m =>
                Math.hypot(m.lat - item.lat, m.lng - item.lng) < 0.003 &&
                m.name.toLowerCase() === item.name.toLowerCase()
            );
            if (!dup) merged.push(item);
          }
          setSuggestions(merged.slice(0, 8));
        }
      } catch {
        // Keep local suggestions on network error
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleChoose = (sug: TamilNaduPlaceSuggestion) => {
    suppressNextSearchRef.current = true;
    onChange(sug.name);
    setOpen(false);
    onSelect({
      name: sug.name,
      displayName: sug.displayName,
      subtitle: sug.subtitle,
      lat: sug.lat,
      lng: sug.lng
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(suggestions.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      if (open && highlightIdx >= 0 && suggestions[highlightIdx]) {
        e.preventDefault();
        handleChoose(suggestions[highlightIdx]);
      } else if (suggestions.length > 0 && value.trim().length > 0) {
        e.preventDefault();
        handleChoose(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-xl bg-[#0D1117] border px-3 py-2.5 transition-all ${
          open || isActive
            ? 'border-[#168BFF] shadow-[0_0_16px_rgba(22,139,255,0.2)]'
            : 'border-white/15 hover:border-white/25'
        }`}
      >
        {badgeText ? (
          <span
            className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 border border-white/80"
            style={{
              backgroundColor: badgeColor,
              color: badgeColor === '#22C55E' ? '#09090B' : '#FAFAFA'
            }}
          >
            {badgeText}
          </span>
        ) : (
          <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
        )}

        <input
          type="text"
          value={value}
          onFocus={() => {
            setOpen(true);
            if (onFocusInput) onFocusInput();
          }}
          onChange={e => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-[#9CA3AF] focus:outline-none min-w-0"
        />

        {loading && <Loader2 className="w-3.5 h-3.5 text-[#168BFF] animate-spin shrink-0" />}

        {value && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onChange('');
              if (onClear) onClear();
              setOpen(true);
            }}
            className="p-1 rounded-md text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Clear location"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {onUseGps && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setOpen(false);
              onUseGps();
            }}
            disabled={locatingGps}
            className="px-2 py-1 rounded-lg bg-[#168BFF]/15 hover:bg-[#168BFF] text-[#FAFAFA] border border-[#168BFF]/40 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            title="Use Current GPS Location"
          >
            <Crosshair className="w-3 h-3" />
            <span>{locatingGps ? '...' : 'GPS'}</span>
          </button>
        )}
      </div>

      {/* Google Maps-Style Live Autocomplete Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[#11131A]/98 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[600] max-h-64 overflow-y-auto divide-y divide-white/[0.06]">
          {onUseGps && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onUseGps();
              }}
              className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-[#168BFF]/15 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-[#168BFF]/20 border border-[#168BFF]/50 flex items-center justify-center shrink-0">
                <Crosshair className="w-3.5 h-3.5 text-[#168BFF]" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#168BFF]">Use Current GPS Location</div>
                <div className="text-[10px] text-[#9CA3AF]">Detect live coordinates automatically</div>
              </div>
            </button>
          )}

          {suggestions.length === 0 && !loading ? (
            <div className="px-3.5 py-3 text-xs text-[#9CA3AF] text-center">
              No matching places found. Try typing a town, area, or click directly on the map.
            </div>
          ) : (
            suggestions.map((sug, idx) => {
              const isHighlighted = idx === highlightIdx;
              return (
                <button
                  key={`${sug.name}-${sug.lat}-${idx}`}
                  type="button"
                  onClick={() => handleChoose(sug)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isHighlighted ? 'bg-white/10' : 'hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{sug.name}</div>
                      <div className="text-[11px] text-[#9CA3AF] truncate">
                        {sug.subtitle || sug.displayName}
                      </div>
                    </div>
                  </div>
                  {sug.type && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.05] text-[#9CA3AF] border border-white/10 shrink-0">
                      {sug.type}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
