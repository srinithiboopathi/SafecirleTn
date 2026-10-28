export type TravelMode = 'walking' | 'biking' | 'driving' | 'foot' | 'bike' | 'car';

export interface Incident {
  id: string;
  lat: number;
  lng: number;
  type:
    | 'theft'
    | 'harassment'
    | 'stalking'
    | 'assault'
    | 'lighting'
    | 'infrastructure'
    | 'weather_hazard'
    | 'safe_zone'
    | 'other'
    | string;
  categoryLabel?: string;
  severity: number | any; // 1-5
  timestamp: string;
  retrievedAt?: string;
  title?: string;
  description: string;
  areaName?: string;
  districtName?: string;
  verified?: boolean;
  source: string;
  sourceName?: string;
  sourceType?:
    | 'osm_overpass'
    | 'open_meteo'
    | 'community_report'
    | 'tn_police_registry'
    | 'demo_simulation'
    | string;
  verificationStatus?:
    | 'verified_external'
    | 'community_reported'
    | 'unverified'
    | 'demo'
    | string;
  confidenceScore?: number;
  isDemo?: boolean;
  [key: string]: any;
}

export interface EmergencyFacility {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'pharmacy' | 'safe_shelter' | string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  open24x7?: boolean;
  source?: string;
  verified?: boolean;
  distanceMeters?: number;
  [key: string]: any;
}

export interface SafetyReport {
  id: string;
  userId: string | null;
  lat: number;
  lng: number;
  issueType: string;
  category?: string;
  description: string;
  severity: number | any;
  timestamp: string;
  submittedAt?: string;
  status: 'pending' | 'verified' | 'resolved' | 'rejected' | string;
  upvotes: number;
  areaName?: string;
  locationName?: string;
  adminNotes?: string;
  [key: string]: any;
}

export interface RouteSegment {
  start: [number, number];
  end: [number, number];
  safetyScore: number;
  riskLevel: string;
}

export interface TrafficCongestionInfo {
  congestionLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  congestionPercentage: number;
  averageSpeedKmh: number;
  freeFlowSpeedKmh: number;
  delayMinutesPer10Km: number;
  peakStatus: string;
  primaryCorridor: string;
  hotspots: string[];
  bypassAdvice: string;
  safetyTrafficNote: string;
}

export interface RouteOption {
  id: string;
  name: string;
  distance: number;
  duration: number;
  mode?: 'foot' | 'bike' | 'car' | string;
  coordinates: [number, number][];
  safetyScore: number;
  riskLevel: string;
  classificationLabel?: string;
  confidence?: number;
  dataCoverageStatus?: 'sufficient' | 'limited';
  districts?: { origin: string; destination: string };
  explanation?: string[];
  traffic?: {
    congestionLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
    congestionPercentage: number;
    averageSpeedKmh: number;
    delayMinutes: number;
    corridorSummary: string;
  };
  metrics?: {
    mappedSafeHavensNearby: number;
    unlitRoadEncounters: number;
    communityReportsNearby: number;
    safeHavenCheckpoints: number;
  };
  segments: RouteSegment[];
  riskZones: any[];
  steps: { instruction: string; distance: number; duration: number }[];
  [key: string]: any;
}

export interface RouteGeometryItem {
  id?: string;
  name: string;
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  summary?: string;
  safetyScore?: number;
  riskLevel?: string;
  steps?: { instruction: string; distanceMeters: number }[];
  [key: string]: any;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  email?: string;
  relationship?: string;
  receiveSos?: boolean;
  receiveJourney?: boolean;
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relation?: string;
  relationship?: string;
  receiveSos?: boolean;
  receiveJourney?: boolean;
  [key: string]: any;
}

export interface JourneySession {
  id: string;
  userId?: string;
  startAddress: string;
  destAddress: string;
  startCoords: [number, number];
  destCoords: [number, number];
  currentCoords: [number, number];
  status: 'active' | 'completed' | 'cancelled' | string;
  startedAt: string;
  etaSeconds?: number;
  distanceMeters?: number;
  travelMode?: TravelMode;
  sharedWith?: TrustedContact[];
  [key: string]: any;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role?: string;
  emergencyContacts: EmergencyContact[];
  [key: string]: any;
}

export interface AssistantLiveContext {
  inTamilNadu: boolean;
  address: string;
  districtName: string;
  policeCommissionerate: string;
  policeControlPhone: string;
  safetyScore: number;
  riskLevel: string;
  weatherSummary: string;
  traffic?: TrafficCongestionInfo;
  nearestPolice: {
    name: string;
    distanceMeters: number;
    phone: string;
    address: string;
    lat: number;
    lng: number;
  } | null;
  nearestHospital: {
    name: string;
    distanceMeters: number;
    phone: string;
    address: string;
    lat: number;
    lng: number;
  } | null;
  nearbyObservationsCount: number;
  timestampIST: string;
}

