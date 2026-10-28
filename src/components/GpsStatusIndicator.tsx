import React, { useState, useEffect } from 'react';
import {
  Navigation,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Compass,
  SlidersHorizontal,
  ChevronDown,
  Info,
  MapPin,
  Wifi,
  Globe
} from 'lucide-react';
import { GpsConnectionStatus, LocationSource } from '../hooks/useRealtimeGps';
import { formatAccuracy } from '../utils/geoUtils';

interface GpsStatusIndicatorProps {
  status: GpsConnectionStatus;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number | null;
  isStale: boolean;
  trackingMode: 'real' | 'demo';
  locationSource?: LocationSource;
  locationLabel?: string | null;
  onRequestPermission: () => void;
  onToggleMode?: () => void;
  onRefresh?: () => void;
  onOpenManualLocation?: () => void;
  className?: string;
  compact?: boolean;
}

export const GpsStatusIndicator: React.FC<GpsStatusIndicatorProps> = ({
  status,
  accuracy,
  speed,
  heading,
  timestamp,
  isStale,
  trackingMode,
  locationSource = 'gps',
  locationLabel,
  onRequestPermission,
  onToggleMode,
  onRefresh,
  onOpenManualLocation,
  className = '',
  compact = false
}) => {
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  useEffect(() => {
    if (!timestamp) return;

    const updateAgo = () => {
      const diffSecs = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
      setSecondsAgo(diffSecs);
    };

    updateAgo();
    const interval = setInterval(updateAgo, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  // Determine Badge visual colors
  let dotColor = 'bg-[#30d158]';
  let badgeBorder = 'border-[#30d158]/30';
  let textColor = 'text-[#30d158]';
  let statusText = 'GPS Connected';

  if (trackingMode === 'demo') {
    dotColor = 'bg-[#bf5af2]';
    badgeBorder = 'border-[#bf5af2]/30';
    textColor = 'text-[#bf5af2]';
    statusText = 'DEMO MODE';
  } else if (status === 'connected' && isStale) {
    dotColor = 'bg-[#ffd60a]';
    badgeBorder = 'border-[#ffd60a]/30';
    textColor = 'text-[#ffd60a]';
    statusText = 'Signal Stale';
  } else if (status === 'connected') {
    dotColor = 'bg-[#30d158]';
    badgeBorder = 'border-[#30d158]/30';
    textColor = 'text-[#30d158]';
    statusText = locationSource === 'gps' ? 'GPS Live' : 'Network Fix';
  } else if (status === 'manual') {
    dotColor = 'bg-[#0a84ff]';
    badgeBorder = 'border-[#0a84ff]/30';
    textColor = 'text-[#0a84ff]';
    statusText = 'Location Set';
  } else if (status === 'ip_fallback') {
    dotColor = 'bg-[#ffd60a]';
    badgeBorder = 'border-[#ffd60a]/30';
    textColor = 'text-[#ffd60a]';
    statusText = 'City / IP Est.';
  } else if (status === 'low_accuracy') {
    dotColor = 'bg-[#ff9f0a]';
    badgeBorder = 'border-[#ff9f0a]/30';
    textColor = 'text-[#ff9f0a]';
    statusText = 'Low Accuracy';
  } else if (status === 'waiting_for_fix' || status === 'requesting') {
    dotColor = 'bg-[#0a84ff] animate-ping';
    badgeBorder = 'border-[#0a84ff]/30';
    textColor = 'text-[#0a84ff]';
    statusText = 'Acquiring GPS...';
  } else if (status === 'denied') {
    dotColor = 'bg-[#ff453a]';
    badgeBorder = 'border-[#ff453a]/30';
    textColor = 'text-[#ff453a]';
    statusText = 'Permission Denied';
  } else if (status === 'unavailable' || status === 'timeout') {
    dotColor = 'bg-[#ff9f0a]';
    badgeBorder = 'border-[#ff9f0a]/30';
    textColor = 'text-[#ff9f0a]';
    statusText = 'GPS Weak / Network';
  } else {
    dotColor = 'bg-[#86868b]';
    badgeBorder = 'border-white/10';
    textColor = 'text-[#a1a1aa]';
    statusText = 'GPS Inactive';
  }

  return (
    <div className={`relative inline-block text-xs ${className}`}>
      {/* Clickable Pill Indicator */}
      <div
        onClick={() => setShowDetails(!showDetails)}
        className={`cursor-pointer select-none bg-[#101114]/90 hover:bg-[#17181c] backdrop-blur-xl border ${badgeBorder} rounded-full px-3 py-1.5 shadow-lg flex items-center space-x-2 transition-all active:scale-98`}
        title="Click to view GPS accuracy or change location"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`}></span>

        <span className={`font-semibold ${textColor} text-[11px] tracking-tight`}>
          {statusText}
        </span>

        {trackingMode === 'real' && accuracy !== null && (
          <>
            <span className="text-white/20">|</span>
            <span className="text-[10px] text-[#e5e5ea] font-medium font-mono">
              ±{Math.round(accuracy)}m
            </span>
          </>
        )}

        {locationLabel && (
          <span className="text-[10px] text-[#a1a1aa] max-w-[100px] truncate hidden md:inline">
            · {locationLabel}
          </span>
        )}

        {trackingMode === 'real' && timestamp && (
          <span className="text-[10px] text-[#86868b] hidden sm:inline">
            {secondsAgo <= 2 ? 'live' : `${secondsAgo}s ago`}
          </span>
        )}

        <ChevronDown className={`w-3 h-3 text-[#a1a1aa] transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </div>

      {/* Floating Detailed Popover */}
      {showDetails && (
        <div className="absolute top-full mt-2 left-0 sm:right-0 sm:left-auto w-80 bg-[#101114] border border-white/15 rounded-2xl p-4 shadow-2xl z-50 text-xs text-[#f5f5f7] space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center space-x-1.5 font-bold">
              <Compass className="w-4 h-4 text-[#0a84ff]" />
              <span>Location Telemetry</span>
            </div>
            <span
              className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                trackingMode === 'real'
                  ? 'bg-[#30d158]/20 text-[#30d158]'
                  : 'bg-[#bf5af2]/20 text-[#bf5af2]'
              }`}
            >
              {trackingMode.toUpperCase()}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#86868b]">Status:</span>
              <span className={`font-semibold ${textColor}`}>{statusText}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-[#86868b]">Source:</span>
              <span className="font-medium text-[#f5f5f7] flex items-center space-x-1">
                {locationSource === 'gps' && <span>🛰️ Device GPS (Satellite)</span>}
                {locationSource === 'network' && <span>📶 Wi-Fi / Cell Triangulation</span>}
                {locationSource === 'ip' && <span>🌐 Regional IP Lookup</span>}
                {locationSource === 'manual' && <span>📍 Manually Set</span>}
                {locationSource === 'simulated' && <span>🎮 Demo Simulator</span>}
              </span>
            </div>

            {locationLabel && (
              <div className="flex justify-between">
                <span className="text-[#86868b]">Area:</span>
                <span className="font-medium text-[#f5f5f7] truncate max-w-[170px]">{locationLabel}</span>
              </div>
            )}

            {trackingMode === 'real' && (
              <>
                <div className="flex justify-between">
                  <span className="text-[#86868b]">Accuracy:</span>
                  <span className="font-mono text-[#f5f5f7]">{formatAccuracy(accuracy)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#86868b]">Heading:</span>
                  <span className="font-mono text-[#f5f5f7]">
                    {heading !== null ? `${Math.round(heading)}° Azimuth` : 'Static / Compass'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#86868b]">Speed:</span>
                  <span className="font-mono text-[#f5f5f7]">
                    {speed !== null ? `${Math.round(speed * 3.6)} km/h` : '0 km/h'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#86868b]">Last Update:</span>
                  <span className="text-[#f5f5f7]">
                    {timestamp ? `${secondsAgo} seconds ago` : 'Awaiting fix'}
                  </span>
                </div>
              </>
            )}

            {status === 'denied' && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                Browser location permission is blocked. Click the lock/tune icon near your browser address bar to allow location, or search your address below.
              </div>
            )}

            {trackingMode === 'demo' && (
              <p className="text-[10px] text-[#a1a1aa] leading-relaxed bg-white/5 p-2 rounded-xl">
                Demo mode simulates movement along the planned route corridor for testing without requiring physical motion outdoors.
              </p>
            )}
          </div>

          {/* Action buttons inside drawer */}
          <div className="pt-1 flex flex-col space-y-1.5 border-t border-white/10">
            {onRefresh && (
              <button
                onClick={() => {
                  onRefresh();
                  setShowDetails(false);
                }}
                className="w-full flex items-center justify-center space-x-1.5 py-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-bold rounded-xl text-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-detect GPS with High Accuracy</span>
              </button>
            )}

            {onOpenManualLocation && (
              <button
                onClick={() => {
                  onOpenManualLocation();
                  setShowDetails(false);
                }}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-[11px] font-semibold transition"
              >
                <MapPin className="w-3 h-3 text-[#30d158]" />
                <span>Search / Set Exact Address</span>
              </button>
            )}

            {onToggleMode && (
              <button
                onClick={() => {
                  onToggleMode();
                  setShowDetails(false);
                }}
                className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-white rounded-xl text-[11px] font-medium transition"
              >
                Switch to {trackingMode === 'real' ? 'Simulated Demo' : 'Real GPS'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
