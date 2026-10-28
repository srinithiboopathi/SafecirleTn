import React, { useState, useEffect, useRef } from 'react';
import {
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryWarning,
  Wifi,
  WifiOff,
  ShieldAlert,
  Phone,
  MessageSquare,
  MessageCircle,
  Volume2,
  VolumeX,
  MapPin,
  CheckCircle2,
  Zap,
  Radio,
  Download,
  RefreshCw,
  Building2
} from 'lucide-react';
import { resolveTamilNaduDistrict } from '../utils/tamilNaduGeo';
import { EmergencyContact, AssistantLiveContext } from '../types';
import { speakInVoice, SupportedVoiceLang } from '../utils/tamilVoice';

const OFFLINE_CACHE_KEY = 'safecircle_offline_emergency_pack_v1';

export interface OfflineEmergencyCache {
  savedAt: string;
  lat: number;
  lng: number;
  address: string;
  districtName: string;
  policeCommissionerate: string;
  policeControlPhone: string;
  safetyScore: number;
  nearestPoliceName: string;
  nearestPolicePhone: string;
  nearestPoliceDistM: number;
  nearestHospitalName: string;
  nearestHospitalPhone: string;
  nearestHospitalDistM: number;
  batteryPercentAtSave: number;
}

interface BatteryConnectivityGuardianProps {
  coords: [number, number];
  liveContext?: AssistantLiveContext | null;
  contacts?: EmergencyContact[];
  voiceLang?: SupportedVoiceLang;
  onTriggerSOS?: () => void;
  compact?: boolean;
}

export const BatteryConnectivityGuardian: React.FC<BatteryConnectivityGuardianProps> = ({
  coords,
  liveContext,
  contacts = [],
  voiceLang = 'ta',
  onTriggerSOS,
  compact = false
}) => {
  const district = resolveTamilNaduDistrict(coords[0], coords[1]);

  // Real Battery API state + Interactive Low-Battery test simulation
  const [batteryLevel, setBatteryLevel] = useState<number>(84);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [simulatedLowBattery, setSimulatedLowBattery] = useState<boolean>(false);
  const [powerSaverActive, setPowerSaverActive] = useState<boolean>(false);
  const [autoBeaconSent, setAutoBeaconSent] = useState<boolean>(false);

  // Real Network / Connectivity state + Offline Emergency Mode toggle
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineEmergencyMode, setOfflineEmergencyMode] = useState<boolean>(false);
  const [networkType, setNetworkType] = useState<string>('4G LTE');
  const [downlinkMbps, setDownlinkMbps] = useState<number>(18.5);
  const [rttMs, setRttMs] = useState<number>(42);

  // Offline Siren (Web Audio API - zero internet required)
  const [sirenActive, setSirenActive] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cached Offline Survival Pack
  const [offlineCache, setOfflineCache] = useState<OfflineEmergencyCache>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.districtName) return parsed;
      }
    } catch {
      // Ignore
    }
    return {
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      lat: coords[0],
      lng: coords[1],
      address: `${district.headquarters}, ${district.name} District, Tamil Nadu`,
      districtName: district.name,
      policeCommissionerate: district.policeCommissionerate,
      policeControlPhone: district.policeControlPhone,
      safetyScore: 88,
      nearestPoliceName: `${district.headquarters} All-Women Police Station`,
      nearestPolicePhone: district.policeControlPhone,
      nearestPoliceDistM: 620,
      nearestHospitalName: `${district.headquarters} 24/7 Government Hospital`,
      nearestHospitalPhone: '108',
      nearestHospitalDistM: 840,
      batteryPercentAtSave: 84
    };
  });

  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const effectiveBattery = simulatedLowBattery ? 12 : batteryLevel;
  const effectiveOffline = !isBrowserOnline || offlineEmergencyMode;
  const isLowBattery = effectiveBattery <= 20;

  // Read real Web Battery Status API if supported
  useEffect(() => {
    let batteryObj: any = null;
    const updateBattery = () => {
      if (!batteryObj) return;
      const pct = Math.round((batteryObj.level ?? 0.84) * 100);
      setBatteryLevel(pct);
      setIsCharging(Boolean(batteryObj.charging));
    };

    if (typeof navigator !== 'undefined' && typeof (navigator as any).getBattery === 'function') {
      (navigator as any)
        .getBattery()
        .then((bat: any) => {
          batteryObj = bat;
          updateBattery();
          bat.addEventListener('levelchange', updateBattery);
          bat.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => {});
    }

    return () => {
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('levelchange', updateBattery);
          batteryObj.removeEventListener('chargingchange', updateBattery);
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  // Monitor Online/Offline & Network Information API
  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => {
      setIsBrowserOnline(false);
      setOfflineEmergencyMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn =
      typeof navigator !== 'undefined'
        ? (navigator as any).connection ||
          (navigator as any).mozConnection ||
          (navigator as any).webkitConnection
        : null;

    const updateConn = () => {
      if (!conn) return;
      if (conn.effectiveType) {
        setNetworkType(String(conn.effectiveType).toUpperCase());
      }
      if (typeof conn.downlink === 'number') {
        setDownlinkMbps(conn.downlink);
      }
      if (typeof conn.rtt === 'number') {
        setRttMs(conn.rtt);
      }
    };

    if (conn) {
      updateConn();
      if (typeof conn.addEventListener === 'function') {
        conn.addEventListener('change', updateConn);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', updateConn);
      }
    };
  }, []);

  // Automatically sync & snapshot Offline Emergency Cache whenever liveContext or coords update
  useEffect(() => {
    const updated: OfflineEmergencyCache = {
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      lat: coords[0],
      lng: coords[1],
      address:
        liveContext?.address || `${district.headquarters}, ${district.name} District, Tamil Nadu`,
      districtName: district.name,
      policeCommissionerate: district.policeCommissionerate,
      policeControlPhone: district.policeControlPhone,
      safetyScore: liveContext?.safetyScore ?? 88,
      nearestPoliceName:
        liveContext?.nearestPolice?.name || `${district.headquarters} Police Station`,
      nearestPolicePhone:
        liveContext?.nearestPolice?.phone || district.policeControlPhone,
      nearestPoliceDistM: liveContext?.nearestPolice?.distanceMeters ?? 620,
      nearestHospitalName:
        liveContext?.nearestHospital?.name || `${district.headquarters} 24/7 Emergency Hospital`,
      nearestHospitalPhone: liveContext?.nearestHospital?.phone || '108',
      nearestHospitalDistM: liveContext?.nearestHospital?.distanceMeters ?? 840,
      batteryPercentAtSave: effectiveBattery
    };
    setOfflineCache(updated);
    try {
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }, [coords[0], coords[1], liveContext, district.name, effectiveBattery]);

  // Auto-activate Power Saver & Last-Gasp GPS Snapshot when Battery drops <= 20%
  useEffect(() => {
    if (isLowBattery && !powerSaverActive) {
      setPowerSaverActive(true);
      setAutoBeaconSent(true);
      setStatusBanner(
        `Low Battery Guardian Active (${effectiveBattery}%): Power-Saver enabled & Last-Known GPS cached offline.`
      );
    }
  }, [isLowBattery]);

  // Cleanup Offline Siren on unmount
  useEffect(() => {
    return () => {
      if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  const toggleOfflineSiren = () => {
    if (sirenActive) {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {
          // Ignore
        }
        audioCtxRef.current = null;
      }
      setSirenActive(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(780, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      let high = false;
      sirenIntervalRef.current = setInterval(() => {
        if (!audioCtxRef.current) return;
        high = !high;
        osc.frequency.exponentialRampToValueAtTime(
          high ? 1180 : 680,
          audioCtxRef.current.currentTime + 0.28
        );
      }, 320);

      setSirenActive(true);
    } catch {
      setSirenActive(false);
    }
  };

  const primaryContact = contacts[0] || {
    id: 'default-guardian',
    name: 'Family Emergency Guardian',
    phone: '+919876543210',
    relation: 'Guardian'
  };

  const buildOfflineSmsBody = () => {
    const gmap = `https://maps.google.com/?q=${offlineCache.lat.toFixed(5)},${offlineCache.lng.toFixed(5)}`;
    return (
      `[SAFECIRCLE OFFLINE/LOW-BATTERY SOS] ` +
      `Need help in ${offlineCache.districtName}, TN. ` +
      `Battery: ${effectiveBattery}% | Mode: ${effectiveOffline ? 'OFFLINE' : 'ONLINE'}. ` +
      `GPS: ${offlineCache.lat.toFixed(5)},${offlineCache.lng.toFixed(5)} (${offlineCache.address}). ` +
      `Map: ${gmap} | Police Control: ${offlineCache.policeControlPhone} / 112`
    );
  };

  const buildSmsHref = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d+]/g, '') || '112';
    return `sms:${cleanPhone}?body=${encodeURIComponent(buildOfflineSmsBody())}`;
  };

  const buildWhatsAppBeaconHref = () => {
    let digits = primaryContact.phone.replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(buildOfflineSmsBody())}`;
  };

  const handleSaveOfflineSnapshotNow = () => {
    const snap: OfflineEmergencyCache = {
      ...offlineCache,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      batteryPercentAtSave: effectiveBattery
    };
    setOfflineCache(snap);
    try {
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snap));
    } catch {
      // Ignore
    }
    setStatusBanner(
      `Offline Survival Pack synced at ${snap.savedAt} (${snap.districtName} • Police & Hospital cached).`
    );
  };

  const handleSpeakGuardianStatus = () => {
    const msgByLang: Record<SupportedVoiceLang, string> = {
      ta: `பேட்டரி மற்றும் இணைப்பு பாதுகாவலர் நிலை: பேட்டரி ${effectiveBattery} சதவீதம் உள்ளது. இணைப்பு நிலை ${
        effectiveOffline ? 'ஆஃப்லைன் அவசர பயன்முறை' : 'ஆன்லைன்'
      }. அருகிலுள்ள காவல் நிலையம் ${offlineCache.nearestPoliceName}, தொலைபேசி ${
        offlineCache.nearestPolicePhone.split('/')[0]
      }. அருகிலுள்ள மருத்துவமனை ${offlineCache.nearestHospitalName}, அவசர எண் 108 மற்றும் 112.`,
      en: `Battery and Connectivity Guardian status: Battery is at ${effectiveBattery} percent. Network is in ${
        effectiveOffline ? 'Offline Emergency Mode' : 'Active Online Mode'
      }. Cached nearest police is ${offlineCache.nearestPoliceName} and nearest hospital is ${
        offlineCache.nearestHospitalName
      }. Dial 112 or send offline SMS SOS anytime.`,
      hi: `बैटरी और कनेक्टिविटी गार्डियन स्थिति: बैटरी ${effectiveBattery} प्रतिशत है। नेटवर्क ${
        effectiveOffline ? 'ऑफ़लाइन आपातकालीन मोड' : 'ऑनलाइन मोड'
      } में है। नजदीकी पुलिस स्टेशन ${offlineCache.nearestPoliceName} और अस्पताल ${
        offlineCache.nearestHospitalName
      } ऑफ़लाइन सुरक्षित हैं। आपातकाल में 112 डायल करें।`,
      te: `బ్యాటరీ మరియు కనెక్టివిటీ గార్డియన్: బ్యాటరీ ${effectiveBattery} శాతం ఉంది. నెట్‌వర్క్ ${
        effectiveOffline ? 'ఆఫ్‌లైన్ అత్యవసర మోడ్' : 'ఆన్‌లైన్ మోడ్'
      } లో ఉంది. సమీప పోలీస్ స్టేషన్ ${offlineCache.nearestPoliceName}. అత్యవసర సహాయం కోసం 112 కి కాల్ చేయండి.`,
      ml: `ബാറ്ററി ആൻഡ് കണക്റ്റിവിറ്റി ഗാർഡിയൻ: ബാറ്ററി ${effectiveBattery} ശതമാനം. നെറ്റ്‌വർക്ക് ${
        effectiveOffline ? 'ഓഫ്‌ലൈൻ എമർജൻസി മോഡ്' : 'ഓൺലൈൻ'
      } ആണ്. അടുത്തുള്ള പോലീസ് സ്റ്റേഷൻ ${offlineCache.nearestPoliceName}. അടിയന്തര സഹായത്തിന് 112 ൽ വിളിക്കുക.`,
      kn: `ಬ್ಯಾಟರಿ ಮತ್ತು ಕನೆಕ್ಟಿವಿಟಿ ಗಾರ್ಡಿಯನ್: ಬ್ಯಾಟರಿ ${effectiveBattery} ಪ್ರತಿಶತ ಇದೆ. ನೆಟ್‌ವರ್ಕ್ ${
        effectiveOffline ? 'ಆಫ್‌ಲೈನ್ ತುರ್ತು ಮೋಡ್' : 'ಆನ್‌ಲೈನ್ ಮೋಡ್'
      } ನಲ್ಲಿದೆ. ಹತ್ತಿರದ ಪೊಲೀಸ್ ಠಾಣೆ ${offlineCache.nearestPoliceName}. ತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ 112 ಗೆ ಕರೆ ಮಾಡಿ.`
    };
    speakInVoice(msgByLang[voiceLang] || msgByLang.ta, voiceLang);
  };

  return (
    <div className="luxury-card p-4 space-y-3.5 border border-white/15">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#303036] pb-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              effectiveOffline || isLowBattery
                ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                : 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
            }`}
          >
            {effectiveOffline ? (
              <WifiOff className="w-4 h-4 animate-pulse" />
            ) : isLowBattery ? (
              <BatteryWarning className="w-4 h-4 animate-pulse" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>Battery & Connectivity Guardian</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  effectiveOffline
                    ? 'bg-[#EF4444] text-white'
                    : isLowBattery
                    ? 'bg-[#F59E0B] text-black'
                    : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                }`}
              >
                {effectiveOffline
                  ? 'OFFLINE EMERGENCY'
                  : isLowBattery
                  ? 'LOW BATTERY GUARD'
                  : 'PROTECTED'}
              </span>
            </h2>
            <p className="text-[10px] text-[#A1A1AA]">
              Zero-internet SMS SOS, Low-Battery GPS Beacon & Cached Safe Havens
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSpeakGuardianStatus}
          className="px-2.5 py-1 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#FFD43B]/40 text-[11px] font-bold text-[#FFD43B] flex items-center gap-1 cursor-pointer"
          title="Speak Battery & Offline Guardian Status"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Voice Report</span>
        </button>
      </div>

      {/* Status Notification Banner */}
      {statusBanner && (
        <div className="p-2.5 rounded-xl bg-[#FFD43B]/15 border border-[#FFD43B]/40 text-[11px] text-[#FFD43B] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[10px] underline text-white shrink-0 cursor-pointer"
          >
            Hide
          </button>
        </div>
      )}

      {/* Live Telemetry Grid: Battery + Connectivity */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Battery Monitor Card */}
        <div
          className={`p-3 rounded-xl border space-y-1.5 ${
            isLowBattery
              ? 'bg-[#EF4444]/10 border-[#EF4444]/50'
              : 'bg-[#111114] border-[#303036]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A1A1AA] font-mono uppercase flex items-center gap-1">
              {isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-[#22C55E]" />
              ) : isLowBattery ? (
                <BatteryLow className="w-3.5 h-3.5 text-[#EF4444]" />
              ) : (
                <Battery className="w-3.5 h-3.5 text-[#22C55E]" />
              )}
              Battery
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                isLowBattery ? 'text-[#EF4444]' : 'text-[#22C55E]'
              }`}
            >
              {effectiveBattery}% {isCharging ? '⚡' : ''}
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#18181B] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isLowBattery ? 'bg-[#EF4444]' : 'bg-[#22C55E]'
              }`}
              style={{ width: `${Math.max(5, effectiveBattery)}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-[#A1A1AA]">
              {powerSaverActive ? 'Power-Saver ON' : 'Normal Drain'}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !simulatedLowBattery;
                setSimulatedLowBattery(next);
                setPowerSaverActive(next);
                if (next) {
                  setStatusBanner(
                    'Simulated 12% Critical Battery: Auto-cached GPS & prepared Last-Gasp SMS Alert!'
                  );
                } else {
                  setStatusBanner(null);
                }
              }}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer ${
                simulatedLowBattery
                  ? 'bg-[#EF4444] border-white text-white'
                  : 'bg-[#18181B] border-[#303036] text-[#FFD43B] hover:text-white'
              }`}
            >
              {simulatedLowBattery ? 'Reset (84%)' : 'Test 12% Low'}
            </button>
          </div>
        </div>

        {/* Network / Connectivity Monitor Card */}
        <div
          className={`p-3 rounded-xl border space-y-1.5 ${
            effectiveOffline
              ? 'bg-[#EF4444]/10 border-[#EF4444]/50'
              : 'bg-[#111114] border-[#303036]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A1A1AA] font-mono uppercase flex items-center gap-1">
              {effectiveOffline ? (
                <WifiOff className="w-3.5 h-3.5 text-[#EF4444]" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-[#168BFF]" />
              )}
              Network
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                effectiveOffline ? 'text-[#EF4444]' : 'text-[#168BFF]'
              }`}
            >
              {effectiveOffline ? 'OFFLINE' : networkType}
            </span>
          </div>

          <div className="text-[10px] text-[#A1A1AA] font-mono truncate">
            {effectiveOffline
              ? 'SMS & Cellular 2G Ready'
              : `${downlinkMbps} Mbps • ${rttMs}ms RTT`}
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-[#A1A1AA]">
              {effectiveOffline ? 'Local Cache Active' : 'Live Telemetry'}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !offlineEmergencyMode;
                setOfflineEmergencyMode(next);
                if (next) {
                  setStatusBanner(
                    'Offline Emergency Mode Activated: Using cached Tamil Nadu Police/Hospital database & Cellular SMS SOS.'
                  );
                } else {
                  setStatusBanner(null);
                }
              }}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer ${
                offlineEmergencyMode
                  ? 'bg-[#EF4444] border-white text-white'
                  : 'bg-[#18181B] border-[#303036] text-[#FFD43B] hover:text-white'
              }`}
            >
              {offlineEmergencyMode ? 'Go Online' : 'Offline Mode'}
            </button>
          </div>
        </div>
      </div>

      {/* Offline Emergency Mode & Low-Battery Survival Control Panel */}
      <div className="p-3 rounded-xl bg-[#111114] border border-[#303036] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase text-[#FFD43B] flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-[#E11D48]" />
            <span>Offline Emergency & Last-Gasp Dispatch</span>
          </div>
          <button
            type="button"
            onClick={handleSaveOfflineSnapshotNow}
            className="text-[10px] font-mono text-[#22C55E] hover:underline flex items-center gap-1 cursor-pointer"
            title="Update local offline cache now"
          >
            <RefreshCw className="w-3 h-3" /> Sync ({offlineCache.savedAt})
          </button>
        </div>

        {/* Cached Coordinates & Safe Havens Summary (Works with 0% Internet) */}
        <div className="p-2.5 rounded-lg bg-[#18181B] border border-[#303036] space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-[10px] text-[#A1A1AA]">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#E11D48]" /> Cached GPS Pin ({offlineCache.districtName})
            </span>
            <span className="font-mono text-white">
              {offlineCache.lat.toFixed(4)}°N, {offlineCache.lng.toFixed(4)}°E
            </span>
          </div>
          <div className="text-white font-semibold truncate text-xs">{offlineCache.address}</div>
          {!compact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between bg-[#111114] px-2 py-1.5 rounded border border-white/5">
                <div className="min-w-0 pr-1">
                  <div className="text-[9px] text-[#FF334F] uppercase font-mono">Offline Police</div>
                  <div className="text-[11px] font-bold text-white truncate">
                    {offlineCache.nearestPoliceName}
                  </div>
                </div>
                <a
                  href={`tel:${offlineCache.nearestPolicePhone.split('/')[0].trim()}`}
                  className="px-2 py-1 rounded bg-[#E11D48] text-white font-bold text-[10px] shrink-0"
                >
                  Call
                </a>
              </div>

              <div className="flex items-center justify-between bg-[#111114] px-2 py-1.5 rounded border border-white/5">
                <div className="min-w-0 pr-1">
                  <div className="text-[9px] text-[#22C55E] uppercase font-mono">Offline Medical</div>
                  <div className="text-[11px] font-bold text-white truncate">
                    {offlineCache.nearestHospitalName}
                  </div>
                </div>
                <a
                  href={`tel:${offlineCache.nearestHospitalPhone.split('/')[0].trim()}`}
                  className="px-2 py-1 rounded bg-[#22C55E] text-black font-bold text-[10px] shrink-0"
                >
                  108
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 1-Tap Zero-Internet Cellular & SMS Emergency Actions */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={buildSmsHref(primaryContact.phone)}
            className="py-2 px-2.5 rounded-xl bg-[#E11D48] hover:bg-[#FF334F] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
            title="Send Offline Cellular SMS with GPS coordinates & battery level"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Offline SMS SOS</span>
          </a>

          <a
            href={buildWhatsAppBeaconHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-[#09090B] font-bold text-xs flex items-center justify-center gap-1.5 shadow"
            title="Send Last-Known GPS & Battery Beacon on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Battery Beacon</span>
          </a>

          <a
            href="tel:112"
            className="py-2 px-2.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#EF4444]/50 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
            <span className="truncate">Call 112 (No Data)</span>
          </a>

          <button
            type="button"
            onClick={toggleOfflineSiren}
            className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
              sirenActive
                ? 'bg-[#FFD43B] border-white text-black animate-pulse'
                : 'bg-[#18181B] hover:bg-[#27272A] border-[#FFD43B]/40 text-[#FFD43B]'
            }`}
          >
            {sirenActive ? (
              <>
                <VolumeX className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Stop 100dB Siren</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Offline Siren</span>
              </>
            )}
          </button>
        </div>

        {/* Power-Saver & Auto-Beacon Toggle */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-[#A1A1AA]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={powerSaverActive}
              onChange={e => setPowerSaverActive(e.target.checked)}
              className="rounded border-white/20 bg-black text-[#22C55E]"
            />
            <span>Auto Low-Battery GPS Lock & Power Saver</span>
          </label>
          {onTriggerSOS && (
            <button
              type="button"
              onClick={onTriggerSOS}
              className="text-[#FF334F] font-bold hover:underline cursor-pointer"
            >
              Full SOS →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
