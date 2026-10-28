import React from 'react';
import {
  Shield,
  MapPin,
  Navigation,
  Lock,
  Compass,
  AlertCircle,
  X
} from 'lucide-react';

interface GpsPermissionModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  onSelectDemoMode: () => void;
}

export const GpsPermissionModal: React.FC<GpsPermissionModalProps> = ({
  isOpen,
  onConfirm,
  onDismiss,
  onSelectDemoMode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#101114] border border-white/15 rounded-3xl p-6 shadow-2xl text-[#f5f5f7] space-y-5">
        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0a84ff] to-[#64b5ff] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#0a84ff]/25">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64b5ff] uppercase tracking-wider block">
              Device Location Services
            </span>
            <h3 className="text-lg font-bold text-[#f5f5f7] leading-tight mt-0.5">
              Enable Real GPS Tracking
            </h3>
          </div>
        </div>

        {/* Plain Explanation */}
        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          SafeCircle AI uses your device’s native GPS to provide real-time personal safety features as you travel:
        </p>

        {/* Feature Highlights */}
        <div className="space-y-2.5 bg-[#17181c] border border-white/5 rounded-2xl p-3.5 text-xs">
          <div className="flex items-start space-x-2.5">
            <Navigation className="w-4 h-4 text-[#30d158] shrink-0 mt-0.5" />
            <span className="text-[#e5e5ea]">
              <strong>Live Turn-by-Turn Navigation:</strong> Continuously moves your vehicle marker along the safest route as you physically move.
            </span>
          </div>

          <div className="flex items-start space-x-2.5">
            <Shield className="w-4 h-4 text-[#0a84ff] shrink-0 mt-0.5" />
            <span className="text-[#e5e5ea]">
              <strong>Corridor Threat Radar:</strong> Dynamically calculates proximity to hazards, poor lighting, and verified safe havens.
            </span>
          </div>

          <div className="flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-[#ffd60a] shrink-0 mt-0.5" />
            <span className="text-[#e5e5ea]">
              <strong>Emergency SOS Accuracy:</strong> Attaches exact latitude, longitude, and accuracy to dispatch when triggering 112 SOS.
            </span>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="flex items-start space-x-2 text-[11px] text-[#86868b] bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
          <AlertCircle className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0 mt-0.5" />
          <span>
            Your coordinates stay on your device and are never shared or sold. Location sharing is only broadcasted when you explicitly activate Journey Sharing or Emergency SOS.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center space-x-2 bg-[#0a84ff] hover:bg-[#0077ed] active:scale-98 text-white font-bold py-3.5 rounded-2xl transition text-xs shadow-lg shadow-[#0a84ff]/25"
          >
            <MapPin className="w-4 h-4" />
            <span>Allow GPS Location Access</span>
          </button>

          <button
            onClick={onSelectDemoMode}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-[#f5f5f7] rounded-2xl text-xs font-semibold transition"
          >
            Continue with Simulated Demo Mode
          </button>
        </div>
      </div>
    </div>
  );
};
