import { db } from '../db.ts';
import {
  isCoordinateInTamilNadu,
  resolveTamilNaduDistrict,
  TAMIL_NADU_DISTRICTS,
  TamilNaduDistrictInfo
} from '../../src/utils/tamilNaduGeo.ts';

export interface ThreatRadarObservation {
  id: string;
  lat: number;
  lng: number;
  type:
    | 'lighting'
    | 'infrastructure'
    | 'weather_hazard'
    | 'harassment'
    | 'theft'
    | 'stalking'
    | 'assault'
    | 'safe_zone'
    | 'other'
    | string;
  categoryLabel: string;
  severity: number; // 1 (Low) to 5 (Critical)
  title: string;
  description: string;
  areaName?: string;
  districtName?: string;
  timestamp: string;
  retrievedAt: string;
  source: string;
  sourceName: string;
  sourceType:
    | 'osm_overpass'
    | 'open_meteo'
    | 'community_report'
    | 'tn_police_registry'
    | 'demo_simulation';
  verificationStatus: 'verified_external' | 'community_reported' | 'unverified' | 'demo';
  confidenceScore: number; // 0 to 100
  isDemo?: boolean;
}

export interface LiveFacilityRecord {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'pharmacy' | 'safe_shelter';
  lat: number;
  lng: number;
  address: string;
  phone: string;
  open24x7: boolean;
  source: string;
  verified: boolean;
  distanceMeters?: number;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  category: string;
  coverage: string;
  updateFrequency: string;
  status: 'online' | 'degraded' | 'offline' | 'historical_only';
  lastUpdated: string;
  recordsCount: number;
  notes: string;
}

export interface RegionalStatisticalSummary {
  region: string;
  districtCode?: string;
  source: string;
  year: string;
  summary: string;
  keyIndicators: { label: string; value: string; note: string }[];
  disclaimer: string;
}

interface CacheEntry {
  timestamp: number;
  facilities: LiveFacilityRecord[];
  infrastructure: ThreatRadarObservation[];
  weatherHazards: ThreatRadarObservation[];
  weatherMeta: {
    temperatureC: number | null;
    windSpeedKmh: number | null;
    precipitationMm: number | null;
    weatherCode: number | null;
    isDay: boolean;
    conditionText: string;
  };
}

const radarCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function severityToNumber(sev: string | number | undefined): number {
  if (typeof sev === 'number') return sev;
  switch (sev) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
      return 2;
    default:
      return 3;
  }
}

function getCacheKey(lat: number, lng: number, radiusMeters: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}_${Math.round(radiusMeters / 1000)}`;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function queryOverpass(query: string): Promise<any> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SafeCircleAI-TamilNadu-Safety/2.0'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Try next mirror
    }
  }
  return null;
}

async function fetchOverpassData(
  lat: number,
  lng: number,
  radiusMeters: number,
  districtName: string
): Promise<{
  facilities: LiveFacilityRecord[];
  infrastructure: ThreatRadarObservation[];
  online: boolean;
}> {
  const safeRadius = Math.min(Math.max(radiusMeters, 2000), 12000);
  const retrievedAt = new Date().toISOString();

  const query = `
    [out:json][timeout:8];
    (
      node["amenity"~"police|hospital|clinic|pharmacy"](around:${safeRadius},${lat},${lng});
      way["amenity"~"police|hospital"](around:${safeRadius},${lat},${lng});
      way["lit"="no"]["highway"~"primary|secondary|tertiary|residential"](around:${Math.min(safeRadius, 5000)},${lat},${lng});
      way["highway"="construction"](around:${Math.min(safeRadius, 6000)},${lat},${lng});
    );
    out center 85;
  `;

  const data = await queryOverpass(query);
  if (!data || !Array.isArray(data.elements)) {
    return { facilities: [], infrastructure: [], online: false };
  }

  const facilities: LiveFacilityRecord[] = [];
  const infrastructure: ThreatRadarObservation[] = [];

  for (const el of data.elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

    if (!isCoordinateInTamilNadu(elLat, elLng)) continue;

    const tags = el.tags || {};

    if (
      tags.amenity === 'police' ||
      tags.amenity === 'hospital' ||
      tags.amenity === 'clinic' ||
      tags.amenity === 'pharmacy'
    ) {
      const type: LiveFacilityRecord['type'] =
        tags.amenity === 'police'
          ? 'police'
          : tags.amenity === 'pharmacy'
          ? 'pharmacy'
          : 'hospital';

      const defaultName =
        type === 'police'
          ? 'Tamil Nadu Police Station (OSM Mapped)'
          : type === 'pharmacy'
          ? 'Medical Pharmacy'
          : 'Medical Care Facility';

      const name = tags.name || tags['name:en'] || tags.operator || defaultName;
      const street = [
        tags['addr:street'],
        tags['addr:suburb'] || tags['addr:district'] || tags['addr:city']
      ]
        .filter(Boolean)
        .join(', ');

      const phone =
        tags.phone ||
        tags['contact:phone'] ||
        (type === 'police' ? '100 / 112' : type === 'hospital' ? '108' : '112');

      facilities.push({
        id: `osm-fac-${el.id}`,
        name,
        type,
        lat: elLat,
        lng: elLng,
        address:
          street ||
          `${districtName} District, Tamil Nadu (${elLat.toFixed(4)}°N, ${elLng.toFixed(4)}°E)`,
        phone,
        open24x7:
          tags.opening_hours === '24/7' || type === 'police' || tags.amenity === 'hospital',
        source: 'OpenStreetMap Contributors (Overpass Live)',
        verified: true,
        distanceMeters: Math.round(haversineMeters(lat, lng, elLat, elLng))
      });
    } else if (tags.lit === 'no') {
      const roadName = tags.name || tags['name:en'] || `${tags.highway || 'Road'} segment`;
      infrastructure.push({
        id: `osm-unlit-${el.id}`,
        lat: elLat,
        lng: elLng,
        type: 'lighting',
        categoryLabel: 'Unlit Road Segment (OSM)',
        severity: 3,
        title: `Unlit Roadway: ${roadName}`,
        description: `OpenStreetMap infrastructure tag indicates no street lighting (lit=no) along this ${
          tags.highway || 'road'
        } corridor in ${districtName}, Tamil Nadu.`,
        areaName: roadName,
        districtName,
        timestamp: retrievedAt,
        retrievedAt,
        source: 'OpenStreetMap Infrastructure Data (Tamil Nadu)',
        sourceName: 'OpenStreetMap Infrastructure Data (Tamil Nadu)',
        sourceType: 'osm_overpass',
        verificationStatus: 'verified_external',
        confidenceScore: 86
      });
    } else if (tags.highway === 'construction') {
      const roadName = tags.name || tags['name:en'] || 'Active Roadway Construction';
      infrastructure.push({
        id: `osm-const-${el.id}`,
        lat: elLat,
        lng: elLng,
        type: 'infrastructure',
        categoryLabel: 'Road Construction / Obstruction',
        severity: 2,
        title: `Roadway Under Construction: ${roadName}`,
        description: `Mapped active road construction segment in ${districtName}, Tamil Nadu. Expect reduced pedestrian access, detours, or uneven lighting.`,
        areaName: roadName,
        districtName,
        timestamp: retrievedAt,
        retrievedAt,
        source: 'OpenStreetMap Infrastructure Data (Tamil Nadu)',
        sourceName: 'OpenStreetMap Infrastructure Data (Tamil Nadu)',
        sourceType: 'osm_overpass',
        verificationStatus: 'verified_external',
        confidenceScore: 84
      });
    }
  }

  return { facilities, infrastructure, online: true };
}

async function fetchOpenMeteoSafetyConditions(lat: number, lng: number, districtName: string) {
  const retrievedAt = new Date().toISOString();
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m,is_day&timezone=Asia%2FKolkata`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('Open-Meteo non-200');
    const data = await res.json();
    const current = data.current || {};

    const temp = typeof current.temperature_2m === 'number' ? current.temperature_2m : null;
    const wind = typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : null;
    const precip = typeof current.precipitation === 'number' ? current.precipitation : 0;
    const code = typeof current.weather_code === 'number' ? current.weather_code : 0;
    const isDay = current.is_day === 1;

    const hazards: ThreatRadarObservation[] = [];
    let conditionText = isDay ? 'Clear Daylight Conditions' : 'Nighttime Operations';

    if (code >= 95) {
      conditionText = 'Thunderstorm / Severe Weather Warning';
      hazards.push({
        id: `meteo-storm-${lat.toFixed(2)}-${lng.toFixed(2)}`,
        lat,
        lng,
        type: 'weather_hazard',
        categoryLabel: 'Severe Weather Hazard',
        severity: 4,
        title: `Active Thunderstorm Advisory (${districtName})`,
        description: `Live Open-Meteo telemetry detects thunderstorm activity (WMO code ${code}, wind ${
          wind ?? 0
        } km/h). Avoid isolated pedestrian corridors and waterlogged underpasses.`,
        areaName: `${districtName} District`,
        districtName,
        timestamp: retrievedAt,
        retrievedAt,
        source: 'Open-Meteo Live Weather Telemetry (Tamil Nadu)',
        sourceName: 'Open-Meteo Live Weather Telemetry (Tamil Nadu)',
        sourceType: 'open_meteo',
        verificationStatus: 'verified_external',
        confidenceScore: 95
      });
    } else if (precip > 2.0 || (code >= 61 && code <= 82)) {
      conditionText = `Active Rainfall (${precip} mm)`;
      hazards.push({
        id: `meteo-rain-${lat.toFixed(2)}-${lng.toFixed(2)}`,
        lat,
        lng,
        type: 'weather_hazard',
        categoryLabel: 'Precipitation / Visibility Caution',
        severity: 3,
        title: `Active Rainfall & Reduced Visibility (${districtName})`,
        description: `Live weather telemetry indicates ${precip} mm precipitation in ${districtName}. Reduced road visibility and slower transit times likely.`,
        areaName: `${districtName} District`,
        districtName,
        timestamp: retrievedAt,
        retrievedAt,
        source: 'Open-Meteo Live Weather Telemetry (Tamil Nadu)',
        sourceName: 'Open-Meteo Live Weather Telemetry (Tamil Nadu)',
        sourceType: 'open_meteo',
        verificationStatus: 'verified_external',
        confidenceScore: 93
      });
    } else if (code >= 45 && code <= 48) {
      conditionText = 'Fog / Low Visibility';
      hazards.push({
        id: `meteo-fog-${lat.toFixed(2)}-${lng.toFixed(2)}`,
        lat,
        lng,
        type: 'weather_hazard',
        categoryLabel: 'Low Visibility Hazard',
        severity: 3,
        title: `Low Visibility / Mist Conditions (${districtName})`,
        description: `Live meteorological reading indicates fog/mist (WMO code ${code}). Prefer primary well-lit corridors.`,
        areaName: `${districtName} District`,
        districtName,
        timestamp: retrievedAt,
        retrievedAt,
        source: 'Open-Meteo Live Weather Telemetry (Tamil Nadu)',
        sourceName: 'Open-Meteo Live Weather Telemetry (Tamil Nadu)',
        sourceType: 'open_meteo',
        verificationStatus: 'verified_external',
        confidenceScore: 91
      });
    } else if (!isDay) {
      conditionText = 'Nighttime Visibility Advisory';
    }

    return {
      online: true,
      hazards,
      meta: {
        temperatureC: temp,
        windSpeedKmh: wind,
        precipitationMm: precip,
        weatherCode: code,
        isDay,
        conditionText
      }
    };
  } catch {
    return {
      online: false,
      hazards: [],
      meta: {
        temperatureC: null,
        windSpeedKmh: null,
        precipitationMm: null,
        weatherCode: null,
        isDay: true,
        conditionText: 'Weather Telemetry Temporarily Unreachable'
      }
    };
  }
}

export async function getLiveThreatRadarData(
  lat: number,
  lng: number,
  radiusMeters: number = 8000,
  includeDemo: boolean = false
) {
  const retrievedAt = new Date().toISOString();

  const inTamilNadu = isCoordinateInTamilNadu(lat, lng);
  if (!inTamilNadu) {
    return {
      outOfBounds: true,
      regionRestrictionMessage:
        'SafeCircle AI currently supports Tamil Nadu, India exclusively. The selected coordinates lie outside Tamil Nadu state boundaries.',
      queriedLocation: { lat, lng, radiusMeters },
      district: null,
      retrievedAt,
      includeDemo,
      observations: [] as ThreatRadarObservation[],
      facilities: [] as LiveFacilityRecord[],
      weather: {
        temperatureC: null,
        windSpeedKmh: null,
        precipitationMm: null,
        weatherCode: null,
        isDay: true,
        conditionText: 'Outside Tamil Nadu Coverage Area'
      },
      sources: [] as DataSourceStatus[],
      statisticalContext: [] as RegionalStatisticalSummary[],
      supportedDistricts: TAMIL_NADU_DISTRICTS
    };
  }

  const districtInfo: TamilNaduDistrictInfo = resolveTamilNaduDistrict(lat, lng);
  const key = getCacheKey(lat, lng, radiusMeters);
  let cached = radarCache.get(key);
  let overpassOnline = true;
  let meteoOnline = true;

  if (!cached || Date.now() - cached.timestamp > CACHE_TTL_MS) {
    const [overpassResult, meteoResult] = await Promise.all([
      fetchOverpassData(lat, lng, radiusMeters, districtInfo.name),
      fetchOpenMeteoSafetyConditions(lat, lng, districtInfo.name)
    ]);

    overpassOnline = overpassResult.online;
    meteoOnline = meteoResult.online;

    cached = {
      timestamp: Date.now(),
      facilities: overpassResult.facilities,
      infrastructure: overpassResult.infrastructure,
      weatherHazards: meteoResult.hazards,
      weatherMeta: meteoResult.meta
    };
    radarCache.set(key, cached);
  }

  const facilityMap = new Map<string, LiveFacilityRecord>();

  for (const f of db.emergencyFacilities) {
    if (!isCoordinateInTamilNadu(f.lat, f.lng)) continue;
    const dist = Math.round(haversineMeters(lat, lng, f.lat, f.lng));
    if (dist <= radiusMeters * 2.5) {
      const normalizedType: LiveFacilityRecord['type'] =
        f.type === 'police'
          ? 'police'
          : f.type === 'pharmacy'
          ? 'pharmacy'
          : 'hospital';

      facilityMap.set(f.id, {
        id: f.id,
        name: f.name,
        type: normalizedType,
        lat: f.lat,
        lng: f.lng,
        address: f.address,
        phone: f.phone,
        open24x7: (f.operatingHours || '').includes('24/7') || normalizedType === 'police',
        source: f.source || 'Tamil Nadu Emergency Directory',
        verified: f.verified,
        distanceMeters: dist
      });
    }
  }

  for (const f of cached.facilities) {
    if (!isCoordinateInTamilNadu(f.lat, f.lng)) continue;
    const isDuplicate = Array.from(facilityMap.values()).some(
      existing =>
        haversineMeters(existing.lat, existing.lng, f.lat, f.lng) < 120 &&
        existing.type === f.type
    );
    if (!isDuplicate) {
      facilityMap.set(f.id, f);
    }
  }

  const facilities = Array.from(facilityMap.values()).sort(
    (a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999)
  );

  const observations: ThreatRadarObservation[] = [];

  for (const item of cached.weatherHazards) {
    if (isCoordinateInTamilNadu(item.lat, item.lng)) {
      observations.push(item);
    }
  }

  for (const item of cached.infrastructure) {
    if (isCoordinateInTamilNadu(item.lat, item.lng)) {
      observations.push(item);
    }
  }

  // Community safety reports submitted via SafeCircle AI
  for (const rep of db.reports) {
    if (!isCoordinateInTamilNadu(rep.lat, rep.lng)) continue;
    const dist = haversineMeters(lat, lng, rep.lat, rep.lng);
    if (dist <= radiusMeters * 3) {
      const repDistrict = resolveTamilNaduDistrict(rep.lat, rep.lng);
      const rawCat = (rep as any).issueType || rep.category || 'other';
      const mappedType =
        rawCat === 'poor_lighting'
          ? 'lighting'
          : rawCat === 'road_hazard' || rawCat === 'infrastructure_gap'
          ? 'infrastructure'
          : rawCat;
      const areaLabel = (rep as any).areaName || rep.locationName || repDistrict.name;
      const ts = (rep as any).timestamp || rep.submittedAt || retrievedAt;

      observations.push({
        id: rep.id,
        lat: rep.lat,
        lng: rep.lng,
        type: mappedType,
        categoryLabel: `Community Report: ${String(rawCat).replace('_', ' ')}`,
        severity: severityToNumber(rep.severity),
        title: `Community Safety Observation (${areaLabel})`,
        description: rep.description,
        areaName: areaLabel,
        districtName: repDistrict.name,
        timestamp: ts,
        retrievedAt,
        source: 'SafeCircle AI Community Report (User Submitted)',
        sourceName: 'SafeCircle AI Community Report (User Submitted)',
        sourceType: 'community_report',
        verificationStatus: 'community_reported',
        confidenceScore: 68,
        isDemo: false
      });
    }
  }

  // Incidents in db.incidents (demo records excluded unless includeDemo === true)
  for (const inc of db.incidents) {
    if (!isCoordinateInTamilNadu(inc.lat, inc.lng)) continue;
    const isSimulated = inc.isDemo === true || inc.verificationStatus === 'demo';
    if (isSimulated && !includeDemo) continue;

    const dist = haversineMeters(lat, lng, inc.lat, inc.lng);
    if (dist <= radiusMeters * 3.5) {
      const incDistrict = resolveTamilNaduDistrict(inc.lat, inc.lng);
      const rawType = (inc as any).type || inc.category || 'other';
      const mappedType =
        rawType === 'poor_lighting'
          ? 'lighting'
          : rawType === 'road_hazard' || rawType === 'infrastructure_gap'
          ? 'infrastructure'
          : rawType;
      const areaLabel = (inc as any).areaName || inc.address || incDistrict.name;
      const ts = (inc as any).timestamp || inc.reportedDate || retrievedAt;

      observations.push({
        id: inc.id,
        lat: inc.lat,
        lng: inc.lng,
        type: mappedType,
        categoryLabel: isSimulated
          ? `Simulated Demo Record (${rawType})`
          : `Recorded Safety Observation (${rawType})`,
        severity: severityToNumber(inc.severity),
        title: isSimulated
          ? `[DEMO SIMULATION] ${inc.title || rawType.toUpperCase()} — ${areaLabel}`
          : `${inc.title || rawType.toUpperCase()} — ${areaLabel}`,
        description: inc.description,
        areaName: areaLabel,
        districtName: incDistrict.name,
        timestamp: ts,
        retrievedAt,
        source: inc.source,
        sourceName: inc.source,
        sourceType: isSimulated ? 'demo_simulation' : 'community_report',
        verificationStatus: isSimulated ? 'demo' : 'community_reported',
        confidenceScore: isSimulated ? 0 : inc.confidenceScore || 72,
        isDemo: isSimulated
      });
    }
  }

  const sources: DataSourceStatus[] = [
    {
      id: 'src-osm-overpass-tn',
      name: 'OpenStreetMap Overpass API (Tamil Nadu)',
      category: 'Police Stations, Hospitals & Road Lighting Tags',
      coverage: `${districtInfo.name} District & All 38 Tamil Nadu Districts`,
      updateFrequency: 'Live query (10-min cache)',
      status: overpassOnline ? 'online' : 'degraded',
      lastUpdated: new Date(cached.timestamp).toISOString(),
      recordsCount: facilities.length + cached.infrastructure.length,
      notes:
        'Mapped Tamil Nadu police stations, emergency medical centers, unlit road segments (lit=no), and active construction zones.'
    },
    {
      id: 'src-open-meteo-tn',
      name: 'Open-Meteo Meteorological Feed (IST)',
      category: 'Weather, Precipitation & Visibility Telemetry',
      coverage: `${districtInfo.name} (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
      updateFrequency: 'Live query (10-min cache)',
      status: meteoOnline ? 'online' : 'degraded',
      lastUpdated: new Date(cached.timestamp).toISOString(),
      recordsCount: cached.weatherHazards.length + 1,
      notes: `Current condition in ${districtInfo.name}: ${cached.weatherMeta.conditionText}${
        cached.weatherMeta.temperatureC !== null ? ` (${cached.weatherMeta.temperatureC}°C)` : ''
      }.`
    },
    {
      id: 'src-community-reports-tn',
      name: 'SafeCircle AI Community Reports (Tamil Nadu)',
      category: 'User-Submitted Street Safety Observations',
      coverage: 'Tamil Nadu State Boundary Validated',
      updateFrequency: 'Real-time on submission',
      status: 'online',
      lastUpdated: retrievedAt,
      recordsCount: db.reports.filter(r => isCoordinateInTamilNadu(r.lat, r.lng)).length,
      notes:
        'Crowd-sourced safety hazards submitted by users inside Tamil Nadu. Labelled as community-reported.'
    },
    {
      id: 'src-tn-scrb-historical',
      name: 'Tamil Nadu State Crime Records Bureau (SCRB) / NCRB',
      category: 'Published District-Level Statistical Context',
      coverage: `${districtInfo.name} (${districtInfo.policeCommissionerate})`,
      updateFrequency: 'Annual Official Publication (Historical)',
      status: 'historical_only',
      lastUpdated: '2024-12-01T00:00:00.000Z',
      recordsCount: TAMIL_NADU_DISTRICTS.length,
      notes:
        'Tamil Nadu Police does not provide a public real-time street-level crime feed. Official SCRB statistics are shown strictly as district-level context and never plotted as fake street pins.'
    }
  ];

  const statisticalContext: RegionalStatisticalSummary[] = [
    {
      region: `${districtInfo.name} District (${districtInfo.policeCommissionerate})`,
      districtCode: districtInfo.id,
      source: 'Tamil Nadu State Crime Records Bureau (SCRB) & District Police Overview',
      year: 'Published Reference Summary',
      summary: districtInfo.scrbSummary,
      keyIndicators: [
        {
          label: 'District Police Control',
          value: districtInfo.policeControlPhone,
          note: `Direct emergency & district control line for ${districtInfo.name}`
        },
        {
          label: 'OSM Infrastructure Coverage',
          value:
            districtInfo.coverageNote === 'high'
              ? 'High (Urban Corridor)'
              : 'Moderate (District Highway & Town)',
          note: 'Coverage of mapped street lighting and 24/7 emergency points in OpenStreetMap'
        },
        {
          label: 'Nearby Mapped Safe Havens',
          value: `${facilities.length} Verified Points`,
          note: `Police stations, hospitals, and pharmacies within ${(radiusMeters / 1000).toFixed(0)} km`
        }
      ],
      disclaimer:
        'District-level reference data only. Tamil Nadu Police does not publish a live street-coordinate crime API; historical statistics are never converted into synthetic map pins.'
    }
  ];

  return {
    outOfBounds: false,
    queriedLocation: { lat, lng, radiusMeters },
    district: districtInfo,
    retrievedAt,
    includeDemo,
    observations,
    facilities,
    weather: cached.weatherMeta,
    sources,
    statisticalContext,
    supportedDistricts: TAMIL_NADU_DISTRICTS
  };
}
