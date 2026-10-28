import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import {
  LiveBackground,
  AmbianceThemeId,
  FrontendColorConfig,
  FRONTEND_COLOR_PRESETS,
  applyFrontendThemeToDocument
} from './components/LiveBackground';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoutePlannerPage } from './pages/RoutePlannerPage';
import { HeatmapPage } from './pages/HeatmapPage';
import { ReportSafetyPage } from './pages/ReportSafetyPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { MultilingualVoiceAssistant } from './components/MultilingualVoiceAssistant';
import { api } from './services/api';
import { EmergencyContact } from './types';
import { isCoordinateInTamilNadu, resolveTamilNaduDistrict } from './utils/tamilNaduGeo';
import { AlertTriangle, Phone, X, MapPin, MessageCircle, ShieldAlert } from 'lucide-react';

const COLOR_STORAGE_KEY = 'safecircle_frontend_colors_v1';

export function App() {
  // Default to Coimbatore, Tamil Nadu [11.0168, 76.9558]
  const [userLocation, setUserLocation] = useState<[number, number]>([11.0168, 76.9558]);
  const [sosActive, setSosActive] = useState(false);
  const [sosData, setSosData] = useState<any>(null);
  const [trustedContacts, setTrustedContacts] = useState<EmergencyContact[]>([]);

  // Frontend Color & Theme State (persisted in localStorage)
  const [colorConfig, setColorConfig] = useState<FrontendColorConfig>(() => {
    try {
      const saved = localStorage.getItem(COLOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.primary && parsed.secondary && parsed.bgBase) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return FRONTEND_COLOR_PRESETS['aurora-prism'];
  });

  useEffect(() => {
    applyFrontendThemeToDocument(colorConfig);
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(colorConfig));
    } catch {
      // Ignore storage errors
    }
  }, [colorConfig]);

  const handleSelectPreset = (presetId: Exclude<AmbianceThemeId, 'custom'>) => {
    const preset = FRONTEND_COLOR_PRESETS[presetId];
    if (preset) {
      setColorConfig(preset);
    }
  };

  const handleUpdateCustomColors = (partial: Partial<FrontendColorConfig>) => {
    setColorConfig(prev => ({
      ...prev,
      ...partial
    }));
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (isCoordinateInTamilNadu(lat, lng)) {
            setUserLocation([lat, lng]);
          }
        },
        () => {
          console.log('Using default Tamil Nadu coordinates (Coimbatore)');
        }
      );
    }
    api
      .getUserProfile()
      .then(p => {
        if (p && p.emergencyContacts) setTrustedContacts(p.emergencyContacts);
      })
      .catch(() => {});
  }, []);

  const handleTriggerSOS = async () => {
    setSosActive(true);
    try {
      const profile = await api.getUserProfile();
      const latestContacts = profile?.emergencyContacts || trustedContacts;
      if (profile?.emergencyContacts) {
        setTrustedContacts(profile.emergencyContacts);
      }

      const primaryPhone =
        latestContacts.length > 0
          ? latestContacts[0].phone.replace(/[^\d+]/g, '')
          : '112';
      window.location.href = `tel:${primaryPhone}`;

      const data = await api.triggerSOS(userLocation[0], userLocation[1]);
      setSosData(data);
    } catch (e) {
      console.error('Failed to trigger SOS', e);
    }
  };

  const buildSOSWhatsAppUrl = (contact: EmergencyContact) => {
    let digits = contact.phone.replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    const gmap = `https://www.google.com/maps?q=${userLocation[0]},${userLocation[1]}`;
    const district = resolveTamilNaduDistrict(userLocation[0], userLocation[1]);
    const msg =
      `🚨 *EMERGENCY SOS ALERT — SAFECIRCLE AI (TAMIL NADU)* 🚨\n\n` +
      `Hi ${contact.name}, I need immediate help!\n` +
      `• *Tamil Nadu District:* ${district.name} (${district.policeCommissionerate})\n` +
      `• *My Current Location:* ${sosData?.address || `${userLocation[0].toFixed(4)}°N, ${userLocation[1].toFixed(4)}°E`}\n` +
      `• *Live GPS Pin:* ${gmap}\n\n` +
      `Please call me or contact Tamil Nadu Police Control (${district.policeControlPhone} / 112) immediately.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  };

  const currentDistrict = resolveTamilNaduDistrict(userLocation[0], userLocation[1]);

  return (
    <Router>
      <div className="min-h-screen bg-transparent text-[#FAFAFA] flex flex-col font-sans relative">
        <LiveBackground colorConfig={colorConfig} />
        <Navbar
          onTriggerSOS={handleTriggerSOS}
          colorConfig={colorConfig}
          onSelectPreset={handleSelectPreset}
          onUpdateCustomColors={handleUpdateCustomColors}
        />

        <main className="flex-1 relative z-10">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/dashboard"
              element={
                <DashboardPage
                  userLocation={userLocation}
                  onTriggerSOS={handleTriggerSOS}
                />
              }
            />
            <Route
              path="/routes"
              element={<RoutePlannerPage userLocation={userLocation} />}
            />
            <Route
              path="/heatmap"
              element={<HeatmapPage userLocation={userLocation} />}
            />
            <Route
              path="/report"
              element={<ReportSafetyPage userLocation={userLocation} />}
            />
            <Route
              path="/assistant"
              element={<AIAssistantPage userLocation={userLocation} />}
            />
          </Routes>
        </main>

        {/* Global Floating Multilingual Voice Assistant */}
        <MultilingualVoiceAssistant userLocation={userLocation} />

        {/* Emergency SOS Modal */}
        {sosActive && (
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="luxury-card border-2 border-[#EF4444]/80 rounded-3xl max-w-md w-full p-6 text-center relative shadow-[0_0_55px_rgba(239,68,68,0.45)] max-h-[92vh] overflow-y-auto space-y-5">
              <button
                onClick={() => {
                  setSosActive(false);
                  setSosData(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/15 text-[#A1A1AA] hover:text-[#FAFAFA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 rounded-full bg-[#EF4444] mx-auto flex items-center justify-center animate-pulse shadow-lg shadow-red-600/40">
                <AlertTriangle className="w-8 h-8 text-[#FAFAFA]" />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF334F]">
                  Tamil Nadu Emergency Protocol Active
                </span>
                <h2 className="text-2xl font-bold text-[#FAFAFA] mt-1">
                  EMERGENCY SOS DISPATCH
                </h2>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  Direct cellular dialer opened. Use the actions below to place a phone call or send your Tamil Nadu GPS pin via WhatsApp to your Guardian Circle or Police Control.
                </p>
              </div>

              <div className="bg-[#18181B] rounded-2xl p-4 text-left border border-[#303036] space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#FF334F] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-[#A1A1AA] uppercase font-mono">
                      Active Tamil Nadu Coordinates ({currentDistrict.name})
                    </div>
                    <div className="text-xs text-[#FAFAFA] font-medium mt-0.5">
                      {sosData ? sosData.address : 'Resolving street address...'}
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] font-mono mt-0.5">
                      {userLocation[0].toFixed(5)}°N, {userLocation[1].toFixed(5)}°E
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#303036] space-y-2">
                  <div className="text-[10px] text-[#A1A1AA] uppercase font-mono">
                    Guardian Circle — Cellular Call & WhatsApp Alert
                  </div>
                  {trustedContacts.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-[#111114] p-2.5 rounded-xl border border-[#303036]"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#FAFAFA]">{c.name}</div>
                        <div className="text-[10px] text-[#A1A1AA] font-mono">{c.phone}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                          className="px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-[#FAFAFA] text-xs font-bold flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call Now
                        </a>
                        <a
                          href={buildSOSWhatsAppUrl(c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#09090B] text-xs font-bold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {trustedContacts.length > 0 && (
                  <a
                    href={`tel:${trustedContacts[0].phone.replace(/[^\d+]/g, '')}`}
                    className="w-full py-3.5 bg-[#EF4444] hover:bg-[#FF334F] text-[#FAFAFA] font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4" /> Call Primary Contact ({trustedContacts[0].name})
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href="tel:112"
                    className="py-3 bg-[#E11D48] hover:bg-[#FF334F] text-[#FAFAFA] font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4" /> TN Police (112)
                  </a>
                  <a
                    href={`tel:${currentDistrict.policeControlPhone}`}
                    className="py-3 bg-[#18181B] hover:bg-[#27272A] border border-[#303036] text-[#FAFAFA] font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[#E11D48]" /> District Control
                  </a>
                </div>

                <button
                  onClick={() => {
                    setSosActive(false);
                    setSosData(null);
                  }}
                  className="w-full py-2.5 bg-[#18181B] hover:bg-[#27272A] border border-[#303036] text-[#A1A1AA] hover:text-[#FAFAFA] font-medium rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Dismiss SOS Window (I Am Safe)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
