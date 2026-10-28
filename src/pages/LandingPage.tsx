import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { motion } from 'motion/react';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput';
import {
  Shield,
  Navigation,
  Radar,
  Route,
  Users,
  ArrowRight,
  MapPin,
  Compass,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';

interface TamilNaduHub {
  id: string;
  label: string;
  city: string;
  coords: [number, number];
}

const MANUAL_PREVIEW_HUBS: TamilNaduHub[] = [
  {
    id: 'annanagar',
    label: 'Anna Nagar Tower, Chennai',
    city: 'Chennai',
    coords: [13.085, 80.2101]
  },
  {
    id: 'tnagar',
    label: 'T. Nagar Panagal Park, Chennai',
    city: 'Chennai',
    coords: [13.0418, 80.2341]
  },
  {
    id: 'adyar',
    label: 'Adyar Signal, Chennai',
    city: 'Chennai',
    coords: [13.0067, 80.2572]
  },
  {
    id: 'gandhipuram',
    label: 'Gandhipuram Central, Coimbatore',
    city: 'Coimbatore',
    coords: [11.0183, 76.9685]
  },
  {
    id: 'rspuram',
    label: 'RS Puram Clock Tower, Coimbatore',
    city: 'Coimbatore',
    coords: [11.0085, 76.9512]
  },
  {
    id: 'peelamedu',
    label: 'Peelamedu Tech Corridor, Coimbatore',
    city: 'Coimbatore',
    coords: [11.0247, 77.0028]
  },
  {
    id: 'madurai',
    label: 'Meenakshi Amman East Gate, Madurai',
    city: 'Madurai',
    coords: [9.9195, 78.1193]
  },
  {
    id: 'trichy',
    label: 'Chatram Bus Stand, Tiruchirappalli',
    city: 'Tiruchirappalli',
    coords: [10.8315, 78.6931]
  }
];

interface FeatureCardItem {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  imageUrl: string;
  imageAlt: string;
  accentColor: string;
  fallbackGradient: string;
}

const KEY_FEATURES: FeatureCardItem[] = [
  {
    title: 'Smart Route Planning',
    description: 'Explore available routes and compare journey information.',
    to: '/routes',
    icon: Navigation,
    imageUrl:
      'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Modern night highway navigation view',
    accentColor: '#168BFF',
    fallbackGradient:
      'radial-gradient(circle at 30% 25%, rgba(22, 139, 255, 0.35), rgba(7, 9, 13, 0.95))'
  },
  {
    title: 'Threat Radar',
    description: 'View available safety reports and reported incidents in your area.',
    to: '/heatmap',
    icon: Radar,
    imageUrl:
      'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Illuminated urban streets at night from above',
    accentColor: '#FFD43B',
    fallbackGradient:
      'radial-gradient(circle at 70% 25%, rgba(255, 212, 59, 0.28), rgba(7, 9, 13, 0.95))'
  },
  {
    title: 'Safe Corridors',
    description: 'Discover potentially safer areas and relevant safety resources.',
    to: '/dashboard',
    icon: Route,
    imageUrl:
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Well-lit modern city avenue at twilight',
    accentColor: '#168BFF',
    fallbackGradient:
      'radial-gradient(circle at 40% 35%, rgba(22, 139, 255, 0.32), rgba(7, 9, 13, 0.95))'
  },
  {
    title: 'Guardian Circle',
    description: 'Stay connected with trusted contacts during your journey.',
    to: '/assistant',
    icon: Users,
    imageUrl:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Group of trusted friends staying connected together',
    accentColor: '#FFD43B',
    fallbackGradient:
      'radial-gradient(circle at 60% 30%, rgba(255, 212, 59, 0.28), rgba(7, 9, 13, 0.95))'
  }
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Choose Your Destination',
    description: 'Manually select your starting point and destination.'
  },
  {
    step: '02',
    title: 'Review Available Routes',
    description:
      'Compare available routes and the safety information supported by available data.'
  },
  {
    step: '03',
    title: 'Travel With Awareness',
    description:
      'Use relevant safety resources and Guardian Circle features where available.'
  }
];

export const LandingPage: React.FC = () => {
  const [heroImgLoaded, setHeroImgLoaded] = useState(true);
  const [failedFeatureImages, setFailedFeatureImages] = useState<Record<string, boolean>>({});

  // Manual Start & End Selection State on the Interactive Preview Map
  const [manualOrigin, setManualOrigin] = useState<{
    label: string;
    coords: [number, number];
  } | null>(null);
  const [manualDestination, setManualDestination] = useState<{
    label: string;
    coords: [number, number];
  } | null>(null);
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');
  const [clickPinMode, setClickPinMode] = useState<'origin' | 'destination'>('origin');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const clickPinModeRef = useRef(clickPinMode);
  clickPinModeRef.current = clickPinMode;
  const manualOriginRef = useRef(manualOrigin);
  manualOriginRef.current = manualOrigin;

  // Haversine approximate distance in km
  const computeDistanceKm = (a: [number, number], b: [number, number]) => {
    const R = 6371;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLon = ((b[1] - a[1]) * Math.PI) / 180;
    const lat1 = (a[0] * Math.PI) / 180;
    const lat2 = (b[0] * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h =
      sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [11.0168, 76.9558],
        zoom: 12,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
      }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        const lat = Number(e.latlng.lat.toFixed(4));
        const lng = Number(e.latlng.lng.toFixed(4));
        const mode = !manualOriginRef.current ? 'origin' : clickPinModeRef.current;

        if (mode === 'origin') {
          const lbl = `${lat}°N, ${lng}°E`;
          setManualOrigin({ label: lbl, coords: [lat, lng] });
          setOriginInput(lbl);
          setClickPinMode('destination');
        } else {
          const lbl = `${lat}°N, ${lng}°E`;
          setManualDestination({ label: lbl, coords: [lat, lng] });
          setDestInput(lbl);
        }
      });

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (manualOrigin) {
      const originIcon = L.divIcon({
        className: 'custom-preview-origin',
        html: `
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:14px;height:14px;border-radius:9999px;background:var(--theme-primary,#168BFF);border:2.5px solid #FFFFFF;box-shadow:0 0 14px rgba(22,139,255,0.9);"></div>
            <span style="padding:3px 8px;border-radius:6px;background:rgba(7,9,13,0.92);border:1px solid var(--theme-primary,#168BFF);color:#FFFFFF;font-size:11px;font-weight:600;white-space:nowrap;">
              Start (A): ${manualOrigin.label.split(',')[0]}
            </span>
          </div>
        `,
        iconSize: [180, 24],
        iconAnchor: [7, 12]
      });
      L.marker(manualOrigin.coords, { icon: originIcon }).addTo(group);
    }

    if (manualDestination) {
      const destIcon = L.divIcon({
        className: 'custom-preview-dest',
        html: `
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:14px;height:14px;border-radius:9999px;background:var(--theme-secondary,#FFD43B);border:2.5px solid #07090D;box-shadow:0 0 14px rgba(255,212,59,0.9);"></div>
            <span style="padding:3px 8px;border-radius:6px;background:rgba(7,9,13,0.92);border:1px solid var(--theme-secondary,#FFD43B);color:var(--theme-secondary,#FFD43B);font-size:11px;font-weight:600;white-space:nowrap;">
              End (B): ${manualDestination.label.split(',')[0]}
            </span>
          </div>
        `,
        iconSize: [180, 24],
        iconAnchor: [7, 12]
      });
      L.marker(manualDestination.coords, { icon: destIcon }).addTo(group);
    }

    if (manualOrigin && manualDestination) {
      const start = manualOrigin.coords;
      const end = manualDestination.coords;
      const midPrimary: [number, number] = [
        (start[0] + end[0]) / 2 + 0.004,
        (start[1] + end[1]) / 2 - 0.003
      ];
      const midAlt: [number, number] = [
        (start[0] + end[0]) / 2 - 0.005,
        (start[1] + end[1]) / 2 + 0.004
      ];

      const primaryPath: [number, number][] = [start, midPrimary, end];
      const altPath: [number, number][] = [start, midAlt, end];

      L.polyline(altPath, {
        color: '#FFD43B',
        weight: 4,
        opacity: 0.75,
        dashArray: '8, 8'
      })
        .bindPopup('Alternative Comparison Route Preview')
        .addTo(group);

      L.polyline(primaryPath, {
        color: '#168BFF',
        weight: 9,
        opacity: 0.25
      }).addTo(group);

      L.polyline(primaryPath, {
        color: '#168BFF',
        weight: 4.5,
        opacity: 0.98
      })
        .bindPopup('Primary Corridor Preview')
        .addTo(group);

      const bounds = L.latLngBounds([...primaryPath, ...altPath]);
      map.fitBounds(bounds, { padding: [52, 52] });
    } else if (manualOrigin) {
      map.setView(manualOrigin.coords, 13, { animate: true });
    } else if (manualDestination) {
      map.setView(manualDestination.coords, 13, { animate: true });
    }
  }, [manualOrigin, manualDestination]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const approxDistKm =
    manualOrigin && manualDestination
      ? `${(computeDistanceKm(manualOrigin.coords, manualDestination.coords) * 1.22).toFixed(1)} km`
      : 'Select Start & End';

  const approxTimeMins =
    manualOrigin && manualDestination
      ? `${Math.max(
          4,
          Math.round(computeDistanceKm(manualOrigin.coords, manualDestination.coords) * 2.4)
        )} mins`
      : 'Select Start & End';

  return (
    <div className="min-h-screen bg-transparent text-white selection:bg-[#168BFF]/30">
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden border-b border-white/[0.07]">
        {/* Cinematic Background Visual + Dark Overlay */}
        <div className="absolute inset-0 z-0">
          {heroImgLoaded && (
            <img
              src="https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=2000&q=85"
              alt="Modern city highway at night in Tamil Nadu"
              onError={() => setHeroImgLoaded(false)}
              className="w-full h-full object-cover object-center scale-105 opacity-45 transition-opacity duration-700"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 75% 30%, color-mix(in srgb, var(--theme-primary) 22%, transparent) 0%, transparent 50%), radial-gradient(circle at 25% 75%, color-mix(in srgb, var(--theme-secondary) 12%, transparent) 0%, transparent 45%), linear-gradient(180deg, rgba(7, 9, 13, 0.68) 0%, rgba(7, 9, 13, 0.86) 65%, var(--theme-bg) 100%)'
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="max-w-3xl space-y-8"
          >
            {/* Small Trust Label */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#FFD43B] shadow-[0_0_10px_#FFD43B]" />
              <span className="text-xs font-medium tracking-wide text-[#E5E7EB]">
                Designed for safer journeys across Tamil Nadu.
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-white">
              TRAVEL SMARTER.{' '}
              <span className="block theme-gradient-text">
                TRAVEL SAFER.
              </span>
            </h1>

            {/* Short Description */}
            <p className="text-lg sm:text-xl text-[#9CA3AF] max-w-2xl leading-relaxed font-normal">
              AI-powered safety insights and safer-route recommendations for your journeys across Tamil Nadu.
            </p>

            {/* Two Prominent Call-To-Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/routes"
                className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#168BFF] hover:bg-[#168BFF]/90 text-white font-semibold text-base shadow-lg transition-all"
              >
                <span>Find a Safe Route</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#features"
                className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-white font-semibold text-base border border-white/15 backdrop-blur-xl transition-all"
              >
                <span>Explore Safety Features</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. KEY FEATURES — MAXIMUM 4 CARDS */}
      <section id="features" className="py-24 lg:py-28 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#168BFF]">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Essential tools for every journey.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {KEY_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              const imgFailed = failedFeatureImages[feature.title];
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                >
                  <Link
                    to={feature.to}
                    className="group block h-full rounded-2xl bg-[#0D1117]/90 border border-white/[0.08] hover:border-[#168BFF]/50 overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]"
                  >
                    <div
                      className="relative h-44 w-full overflow-hidden"
                      style={{ background: feature.fallbackGradient }}
                    >
                      {!imgFailed && (
                        <img
                          src={feature.imageUrl}
                          alt={feature.imageAlt}
                          loading="lazy"
                          onError={() =>
                            setFailedFeatureImages(prev => ({ ...prev, [feature.title]: true }))
                          }
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-75"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/35 to-transparent" />
                      <div
                        className="absolute bottom-3 left-4 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/15"
                        style={{ backgroundColor: 'rgba(7, 9, 13, 0.75)' }}
                      >
                        <Icon
                          className="w-5 h-5"
                          style={{ color: feature.accentColor }}
                        />
                      </div>
                    </div>

                    <div className="p-6 space-y-2">
                      <h3 className="text-lg font-bold text-white group-hover:text-[#168BFF] transition-colors flex items-center justify-between">
                        <span>{feature.title}</span>
                        <ArrowRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#FFD43B] group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      <p className="text-sm text-[#9CA3AF] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS — SIMPLE 3-STEP SECTION */}
      <section className="py-20 lg:py-24 border-y border-white/[0.06] bg-[#0A0D14]/60 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#FFD43B]">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Three simple steps to plan your trip.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS_STEPS.map((item, idx) => (
              <div
                key={item.step}
                className="relative p-7 rounded-2xl bg-[#0D1117]/80 border border-white/[0.08] space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-bold px-3 py-1 rounded-md ${
                      idx === 1
                        ? 'bg-[#FFD43B]/15 text-[#FFD43B] border border-[#FFD43B]/30'
                        : 'bg-[#168BFF]/15 text-[#168BFF] border border-[#168BFF]/30'
                    }`}
                  >
                    STEP {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">{item.title}</h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. MAP PREVIEW SECTION — USER MANUALLY SELECTS START & END */}
      <section className="py-24 lg:py-28 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#168BFF]">
                Interactive Tamil Nadu Map Preview
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Select your start and end points.
              </h2>
              <p className="text-sm text-[#9CA3AF]">
                Choose your Start (A) and Destination (B) manually using the selectors or by clicking directly on the map to preview corridor comparison.
              </p>
            </div>

            {/* Map Click Mode Toggle */}
            <div className="inline-flex items-center gap-2 p-1.5 rounded-xl bg-[#0D1117] border border-white/10 self-start">
              <button
                type="button"
                onClick={() => setClickPinMode('origin')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  clickPinMode === 'origin'
                    ? 'bg-[#168BFF] text-white'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Click Map: Set Start (A)
              </button>
              <button
                type="button"
                onClick={() => setClickPinMode('destination')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  clickPinMode === 'destination'
                    ? 'bg-[#FFD43B] text-black'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Click Map: Set End (B)
              </button>
              {(manualOrigin || manualDestination) && (
                <button
                  type="button"
                  onClick={() => {
                    setManualOrigin(null);
                    setManualDestination(null);
                    setClickPinMode('origin');
                  }}
                  className="px-2.5 py-2 rounded-lg text-xs text-[#9CA3AF] hover:text-white cursor-pointer flex items-center gap-1"
                  title="Clear pins"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Dark-Themed Map Container */}
            <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-white/10 bg-[#0D1117] min-h-[440px] relative shadow-[0_24px_56px_-16px_rgba(0,0,0,0.85)]">
              <div ref={mapContainerRef} className="w-full h-[440px] map-dark-tiles" />
              {(!manualOrigin || !manualDestination) && (
                <div className="absolute top-3 left-14 right-4 z-[400] pointer-events-none flex justify-center">
                  <div className="px-3.5 py-1.5 rounded-lg bg-[#07090D]/90 border border-white/15 backdrop-blur-md text-xs text-white flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                    <span>
                      {!manualOrigin
                        ? 'Click on the map or choose from the panel to set Start Location (A)'
                        : 'Now click on the map or choose from the panel to set Destination (B)'}
                    </span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 z-[400] px-3 py-1.5 rounded-lg bg-[#07090D]/90 border border-white/10 backdrop-blur-md text-[11px] text-[#9CA3AF] flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-white">
                  <span className="w-2.5 h-1 rounded-full bg-[#168BFF]" /> Primary Corridor
                </span>
                <span className="flex items-center gap-1.5 text-[#FFD43B]">
                  <span className="w-2.5 h-1 rounded-full bg-[#FFD43B]" /> Alternative Route
                </span>
              </div>
            </div>

            {/* Manual Origin & Destination Panel */}
            <div className="lg:col-span-4 rounded-2xl bg-[#0D1117]/90 border border-white/10 p-6 sm:p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#FFD43B]">
                      Manual Route Preview
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      Select Start & Destination
                    </h3>
                  </div>
                  <Compass className="w-5 h-5 text-[#168BFF]" />
                </div>

                {/* Google Maps-Style Start & Destination Autocomplete */}
                <div className="space-y-3 text-sm">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#9CA3AF] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#168BFF]" />
                      <span>Start Location (A)</span>
                    </label>
                    <LocationAutocompleteInput
                      value={originInput}
                      onChange={setOriginInput}
                      badgeText="A"
                      badgeColor="#168BFF"
                      placeholder="Type any start place or click map..."
                      onClear={() => setManualOrigin(null)}
                      onSelect={place => {
                        setManualOrigin({ label: place.name, coords: [place.lat, place.lng] });
                        setClickPinMode('destination');
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-[#9CA3AF] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FFD43B]" />
                      <span>Destination Location (B)</span>
                    </label>
                    <LocationAutocompleteInput
                      value={destInput}
                      onChange={setDestInput}
                      badgeText="B"
                      badgeColor="#22C55E"
                      placeholder="Type any destination or click map..."
                      onClear={() => setManualDestination(null)}
                      onSelect={place => {
                        setManualDestination({ label: place.name, coords: [place.lat, place.lng] });
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <div className="text-xs text-[#9CA3AF]">Approx. Distance</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {approxDistKm}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <div className="text-xs text-[#9CA3AF]">Est. Travel Time</div>
                    <div className="text-sm font-bold text-[#FFD43B] mt-0.5">
                      {approxTimeMins}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#168BFF]/10 border border-[#168BFF]/25 text-xs text-[#E5E7EB] leading-relaxed flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#168BFF] shrink-0 mt-0.5" />
                  <span>
                    {manualOrigin && manualDestination
                      ? 'Previewing primary and alternative paths between your manually selected points.'
                      : 'Select both Start (A) and End (B) above or by clicking on the map to preview routes.'}
                  </span>
                </div>
              </div>

              <Link
                to="/routes"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#168BFF] hover:bg-[#168BFF]/90 text-white font-semibold text-sm shadow-lg transition-all"
              >
                <span>Open Full Route Planner</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FINAL CALL TO ACTION */}
      <section className="py-24 lg:py-28 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl p-10 sm:p-16 text-center border border-white/10 bg-gradient-to-b from-[#111827]/90 to-[#07090D] shadow-[0_28px_64px_-16px_rgba(0,0,0,0.85)] relative overflow-hidden">
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--theme-primary) 25%, transparent) 0%, color-mix(in srgb, var(--theme-secondary) 12%, transparent) 50%, transparent 75%)',
                filter: 'blur(40px)'
              }}
            />

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                YOUR JOURNEY. YOUR SAFETY.{' '}
                <span className="text-[#FFD43B]">YOUR CIRCLE.</span>
              </h2>
              <p className="text-base sm:text-lg text-[#9CA3AF]">
                Make informed travel decisions with SafeCircle AI.
              </p>
              <div className="pt-2">
                <Link
                  to="/routes"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-[#168BFF] hover:bg-[#168BFF]/90 text-white font-semibold text-base shadow-lg transition-all"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. MINIMAL FOOTER */}
      <footer className="border-t border-white/[0.08] bg-[#07090D] py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#168BFF]/15 border border-[#168BFF]/40 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#168BFF]" />
                </div>
                <span className="text-base font-bold tracking-tight text-white">
                  SafeCircle <span className="text-[#168BFF]">AI</span>
                </span>
              </Link>
              <p className="text-xs text-[#9CA3AF]">
                AI-powered route awareness and personal safety tools for Tamil Nadu, India.
              </p>
            </div>

            <nav className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#9CA3AF]">
              <Link to="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <Link to="/routes" className="hover:text-white transition-colors">
                Route Planner
              </Link>
              <Link to="/heatmap" className="hover:text-white transition-colors">
                Threat Radar
              </Link>
              <Link to="/dashboard" className="hover:text-white transition-colors">
                Safe Corridors
              </Link>
              <Link to="/assistant" className="hover:text-white transition-colors">
                Guardian Circle
              </Link>
            </nav>
          </div>

          <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-[#9CA3AF]">
            <p>
              Data & Safety Disclaimer: Route comparisons and safety layers rely on publicly accessible OpenStreetMap infrastructure, weather data, and community submissions within Tamil Nadu. Always dial 112 in an active emergency.
            </p>
            <span className="shrink-0 text-[#9CA3AF]">© {new Date().getFullYear()} SafeCircle AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
