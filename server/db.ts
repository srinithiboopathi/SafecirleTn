import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'user' | 'admin';
  emergencyNotes?: string;
  createdAt: string;
}

export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  receiveSos: boolean;
  receiveJourney: boolean;
  createdAt: string;
}

export interface SafetyIncident {
  id: string;
  title: string;
  category:
    | 'poor_lighting'
    | 'harassment'
    | 'road_hazard'
    | 'accident_zone'
    | 'infrastructure_gap'
    | 'isolated_area'
    | 'weather_hazard';
  severity: 'low' | 'medium' | 'high' | 'critical';
  lat: number;
  lng: number;
  description: string;
  reportedDate: string;
  source: string;
  verificationStatus: 'verified' | 'under_review' | 'community' | 'unverified' | 'demo';
  confidenceScore: number; // 0 to 100
  address?: string;
  classification?: string;
  sourceId?: string;
  sourceUrl?: string;
  eventTimestamp?: string | null;
  retrievedAt?: string;
  lastUpdated?: string;
  freshness?: string;
  isDemo?: boolean;
}

export interface SafetyReport {
  id: string;
  userId: string;
  reporterName: string;
  category:
    | 'poor_lighting'
    | 'harassment'
    | 'road_hazard'
    | 'accident_zone'
    | 'infrastructure_gap'
    | 'isolated_area';
  severity: 'low' | 'medium' | 'high' | 'critical';
  lat: number;
  lng: number;
  locationName: string;
  description: string;
  submittedAt: string;
  status: 'pending' | 'under_review' | 'verified' | 'rejected';
  adminNotes?: string;
}

export interface EmergencyFacility {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'clinic' | 'pharmacy';
  lat: number;
  lng: number;
  address: string;
  phone: string;
  operatingHours: string;
  verified: boolean;
  district?: string;
  source?: string;
}

export interface EmergencyEvent {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  lat: number;
  lng: number;
  address: string;
  timestamp: string;
  status: 'active' | 'resolved' | 'cancelled';
  cancellationReason?: string;
  notifiedContacts: {
    contactId: string;
    name: string;
    phone: string;
    status: 'delivered' | 'simulated' | 'failed';
    deliveredAt: string;
  }[];
  emergencyServicesContacted: boolean;
}

export interface JourneySession {
  id: string;
  token: string;
  userId: string;
  userName: string;
  startAddress: string;
  destAddress: string;
  startCoords: [number, number];
  destCoords: [number, number];
  currentCoords: [number, number];
  etaMinutes: number;
  startedAt: string;
  expiresAt: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  sharedContactIds: string[];
  batteryLevel?: number;
  travelMode?: 'walking' | 'biking' | 'driving';
  progressPercent?: number;
  remainingMeters?: number;
  remainingSeconds?: number;
  speedKmh?: number;
  heading?: number | null;
  accuracy?: number | null;
  routeCoordinates?: [number, number][];
  lastUpdatedAt?: string;
  breadcrumbs: { lat: number; lng: number; timestamp: string }[];
}

export interface SavedRoute {
  id: string;
  userId: string;
  name: string;
  fromName: string;
  toName: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  preferredMode: 'walking' | 'biking' | 'driving';
  savedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'emergency' | 'safety_alert' | 'journey_update' | 'report_status' | 'weather';
  read: boolean;
  createdAt: string;
  metadata?: any;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  ip: string;
  timestamp: string;
}

const PERSIST_DIR = path.join(process.cwd(), '.data');
const PERSIST_FILE = path.join(PERSIST_DIR, 'safecircle_store.json');

// Database Store with Real Disk Persistence for Contacts, Journeys, Saved Routes & User Reports
class DatabaseStore {
  users: User[] = [];
  contacts: TrustedContact[] = [];
  incidents: SafetyIncident[] = [];
  reports: SafetyReport[] = [];
  emergencyFacilities: EmergencyFacility[] = [];
  emergencyEvents: EmergencyEvent[] = [];
  journeys: JourneySession[] = [];
  savedRoutes: SavedRoute[] = [];
  notifications: NotificationItem[] = [];
  auditLogs: AuditLog[] = [];

  constructor() {
    this.seedData();
    this.loadPersistedData();
  }

  private loadPersistedData() {
    try {
      if (fs.existsSync(PERSIST_FILE)) {
        const raw = fs.readFileSync(PERSIST_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.contacts)) {
          this.contacts = parsed.contacts;
        }
        if (Array.isArray(parsed.journeys)) {
          this.journeys = parsed.journeys;
        }
        if (Array.isArray(parsed.savedRoutes)) {
          this.savedRoutes = parsed.savedRoutes;
        }
        if (Array.isArray(parsed.reports) && parsed.reports.length > 0) {
          this.reports = parsed.reports;
        }
      }
    } catch (e) {
      console.warn('Could not load persisted store:', e);
    }
  }

  public saveToDisk() {
    try {
      if (!fs.existsSync(PERSIST_DIR)) {
        fs.mkdirSync(PERSIST_DIR, { recursive: true });
      }
      fs.writeFileSync(
        PERSIST_FILE,
        JSON.stringify(
          {
            contacts: this.contacts,
            journeys: this.journeys,
            savedRoutes: this.savedRoutes,
            reports: this.reports
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (e) {
      console.warn('Could not persist store to disk:', e);
    }
  }

  private seedData() {
    // 1. Initial Users
    this.users = [
      {
        id: 'usr-demo-1',
        name: 'Traveler',
        email: 'user@safecircle.org',
        phone: '',
        passwordHash: 'password123',
        role: 'user',
        emergencyNotes: '',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        id: 'usr-admin-1',
        name: 'Safety Coordinator',
        email: 'admin@safecircle.org',
        phone: '+91 422 230 0970',
        passwordHash: 'admin123',
        role: 'admin',
        emergencyNotes: 'Tamil Nadu Safety Operations Coordinator',
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
      }
    ];

    // 2. Trusted Contacts: Start empty — NO mock contacts. Only real manually saved contacts are stored.
    this.contacts = [];

    // 3. Demonstration-Only Seeded Incidents in Tamil Nadu (ISOLATED behind isDemo: true; NEVER shown in Live Mode unless user enables Demonstration Mode)
    this.incidents = [
      {
        id: 'inc-101',
        title: 'Streetlight Outage on Cross Cut Road Stretch',
        category: 'poor_lighting',
        severity: 'high',
        lat: 11.0195,
        lng: 76.9654,
        description:
          'Demonstration record: Dark stretch of approximately 300m between Power House and 7th Street corner in Gandhipuram, Coimbatore.',
        reportedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        source: 'Demonstration Dataset',
        verificationStatus: 'demo',
        confidenceScore: 80,
        address: 'Cross Cut Road, Gandhipuram, Coimbatore, Tamil Nadu',
        classification: 'Demonstration Data',
        isDemo: true
      },
      {
        id: 'inc-103',
        title: 'Stormwater Drain Excavation on NSR Road',
        category: 'road_hazard',
        severity: 'medium',
        lat: 11.0268,
        lng: 76.9431,
        description:
          'Demonstration record: Open drainage excavation along pedestrian shoulder on NSR Road, Saibaba Colony, Coimbatore.',
        reportedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        source: 'Demonstration Dataset',
        verificationStatus: 'demo',
        confidenceScore: 85,
        address: 'NSR Road, Saibaba Colony, Coimbatore, Tamil Nadu',
        classification: 'Demonstration Data',
        isDemo: true
      },
      {
        id: 'inc-108',
        title: 'Low-Lit Subway Approach Near T. Nagar Bus Terminus',
        category: 'poor_lighting',
        severity: 'medium',
        lat: 13.0418,
        lng: 80.2341,
        description:
          'Demonstration record: Reduced pedestrian lighting along the service approach near Usman Road, T. Nagar, Chennai.',
        reportedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        source: 'Demonstration Dataset',
        verificationStatus: 'demo',
        confidenceScore: 78,
        address: 'Usman Road, T. Nagar, Chennai, Tamil Nadu',
        classification: 'Demonstration Data',
        isDemo: true
      }
    ];

    // 4. Verified Tamil Nadu Emergency Facilities (Police Stations, 24/7 Govt & Trauma Hospitals, 24/7 Pharmacies across Tamil Nadu)
    this.emergencyFacilities = [
      // COIMBATORE
      {
        id: 'fac-cbe-1',
        name: 'B-2 R.S. Puram Police Station',
        type: 'police',
        lat: 11.0115,
        lng: 76.9462,
        address: 'Diwan Bahadur Road, R.S. Puram, Coimbatore, Tamil Nadu',
        phone: '+91 422 254 1100',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Coimbatore',
        source: 'Tamil Nadu Police Directory'
      },
      {
        id: 'fac-cbe-2',
        name: 'Coimbatore Medical College Hospital (CMCH)',
        type: 'hospital',
        lat: 10.9965,
        lng: 76.9678,
        address: 'Trichy Road, Gopalapuram, Coimbatore, Tamil Nadu',
        phone: '+91 422 230 1393',
        operatingHours: '24/7 Government Emergency & Trauma',
        verified: true,
        district: 'Coimbatore',
        source: 'Tamil Nadu Health Department'
      },
      {
        id: 'fac-cbe-3',
        name: 'PSG Hospitals 24/7 Emergency & Trauma',
        type: 'hospital',
        lat: 11.0252,
        lng: 77.0035,
        address: 'Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu',
        phone: '+91 422 257 0170',
        operatingHours: '24/7 Emergency Trauma Care',
        verified: true,
        district: 'Coimbatore',
        source: 'OpenStreetMap & Verified Hospital Registry'
      },
      {
        id: 'fac-cbe-4',
        name: 'B-3 Kattoor / Gandhipuram Police Station',
        type: 'police',
        lat: 11.0185,
        lng: 76.9645,
        address: 'Cross Cut Road, Gandhipuram, Coimbatore, Tamil Nadu',
        phone: '+91 422 223 1500',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Coimbatore',
        source: 'Tamil Nadu Police Directory'
      },
      {
        id: 'fac-cbe-5',
        name: 'Ganga Hospital 24/7 Trauma Center',
        type: 'hospital',
        lat: 11.0285,
        lng: 76.9442,
        address: '313, Mettupalayam Road, Saibaba Colony, Coimbatore, Tamil Nadu',
        phone: '+91 422 248 5000',
        operatingHours: '24/7 Emergency & Trauma',
        verified: true,
        district: 'Coimbatore',
        source: 'OpenStreetMap & Verified Hospital Registry'
      },
      {
        id: 'fac-cbe-6',
        name: 'E-2 Peelamedu Police Station',
        type: 'police',
        lat: 11.0265,
        lng: 77.0018,
        address: 'Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu',
        phone: '+91 422 257 1200',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Coimbatore',
        source: 'Tamil Nadu Police Directory'
      },
      {
        id: 'fac-cbe-7',
        name: 'Apollo Pharmacy 24/7 R.S. Puram',
        type: 'pharmacy',
        lat: 11.0108,
        lng: 76.9472,
        address: 'DB Road, R.S. Puram, Coimbatore, Tamil Nadu',
        phone: '+91 422 254 8899',
        operatingHours: '24 Hours Open',
        verified: true,
        district: 'Coimbatore',
        source: 'OpenStreetMap Verified Amenity'
      },
      // CHENNAI
      {
        id: 'fac-chn-1',
        name: 'R-1 Mambalam / T. Nagar Police Station',
        type: 'police',
        lat: 13.0382,
        lng: 80.2317,
        address: 'Madley Road, T. Nagar, Chennai, Tamil Nadu',
        phone: '+91 44 2345 2566',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Chennai',
        source: 'Greater Chennai Police Directory'
      },
      {
        id: 'fac-chn-2',
        name: 'Rajiv Gandhi Government General Hospital (RGGGH)',
        type: 'hospital',
        lat: 13.0818,
        lng: 80.2772,
        address: 'Poonamallee High Road, Park Town (Central), Chennai, Tamil Nadu',
        phone: '+91 44 2530 5000',
        operatingHours: '24/7 Government Trauma & Emergency',
        verified: true,
        district: 'Chennai',
        source: 'Tamil Nadu Health Department'
      },
      {
        id: 'fac-chn-3',
        name: 'J-2 Adyar Police Station & All Women Police Station',
        type: 'police',
        lat: 13.0063,
        lng: 80.2574,
        address: 'Lattice Bridge Road, Adyar, Chennai, Tamil Nadu',
        phone: '+91 44 2345 2612',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Chennai',
        source: 'Greater Chennai Police Directory'
      },
      {
        id: 'fac-chn-4',
        name: 'Apollo Hospitals Greams Road 24/7 Emergency',
        type: 'hospital',
        lat: 13.0628,
        lng: 80.2516,
        address: '21, Greams Lane, Thousand Lights, Chennai, Tamil Nadu',
        phone: '+91 44 2829 3333',
        operatingHours: '24/7 Emergency & Trauma',
        verified: true,
        district: 'Chennai',
        source: 'OpenStreetMap & Verified Hospital Registry'
      },
      // MADURAI
      {
        id: 'fac-mdu-1',
        name: 'B-1 Vilakkuthoon / Meenakshi Temple Police Station',
        type: 'police',
        lat: 9.9178,
        lng: 78.1225,
        address: 'East Veli Street, Madurai, Tamil Nadu',
        phone: '+91 452 233 0600',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Madurai',
        source: 'Tamil Nadu Police Directory'
      },
      {
        id: 'fac-mdu-2',
        name: 'Government Rajaji Hospital (GRH) Madurai',
        type: 'hospital',
        lat: 9.9279,
        lng: 78.1369,
        address: 'Panagal Road, Goripalayam, Madurai, Tamil Nadu',
        phone: '+91 452 253 2535',
        operatingHours: '24/7 Government Trauma & Emergency',
        verified: true,
        district: 'Madurai',
        source: 'Tamil Nadu Health Department'
      },
      // TIRUCHIRAPPALLI (TRICHY)
      {
        id: 'fac-try-1',
        name: 'Cantonment Police Station & AWPS Trichy',
        type: 'police',
        lat: 10.8055,
        lng: 78.6856,
        address: 'Williams Road, Cantonment, Tiruchirappalli, Tamil Nadu',
        phone: '+91 431 241 4455',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Tiruchirappalli',
        source: 'Tamil Nadu Police Directory'
      },
      {
        id: 'fac-try-2',
        name: 'Mahatma Gandhi Memorial Government Hospital (MGMGH)',
        type: 'hospital',
        lat: 10.8105,
        lng: 78.6812,
        address: 'Puthur High Road, Tiruchirappalli, Tamil Nadu',
        phone: '+91 431 277 1461',
        operatingHours: '24/7 Government Trauma Care',
        verified: true,
        district: 'Tiruchirappalli',
        source: 'Tamil Nadu Health Department'
      },
      // SALEM
      {
        id: 'fac-slm-1',
        name: 'Salem Town Police Station & All Women Wing',
        type: 'police',
        lat: 11.6538,
        lng: 78.1585,
        address: 'Bazaar Street, Salem Town, Salem, Tamil Nadu',
        phone: '+91 427 226 0200',
        operatingHours: '24/7 Hours',
        verified: true,
        district: 'Salem',
        source: 'Tamil Nadu Police Directory'
      },
      {
        id: 'fac-slm-2',
        name: 'Government Mohan Kumaramangalam Medical College Hospital',
        type: 'hospital',
        lat: 11.6512,
        lng: 78.1542,
        address: 'Fort Main Road, Salem, Tamil Nadu',
        phone: '+91 427 221 0466',
        operatingHours: '24/7 Government Emergency',
        verified: true,
        district: 'Salem',
        source: 'Tamil Nadu Health Department'
      },
      // TIRUNELVELI & VELLORE
      {
        id: 'fac-tvl-1',
        name: 'Tirunelveli Medical College Hospital (TVMCH)',
        type: 'hospital',
        lat: 8.7132,
        lng: 77.7524,
        address: 'High Ground Road, Palayamkottai, Tirunelveli, Tamil Nadu',
        phone: '+91 462 257 2733',
        operatingHours: '24/7 Government Emergency',
        verified: true,
        district: 'Tirunelveli',
        source: 'Tamil Nadu Health Department'
      },
      {
        id: 'fac-vlr-1',
        name: 'Christian Medical College (CMC) Vellore 24/7 Casualty',
        type: 'hospital',
        lat: 12.9246,
        lng: 79.1353,
        address: 'Ida Scudder Road, Vellore, Tamil Nadu',
        phone: '+91 416 228 1000',
        operatingHours: '24/7 Trauma & Emergency Care',
        verified: true,
        district: 'Vellore',
        source: 'OpenStreetMap & Verified Hospital Registry'
      }
    ];

    // 5. User-Submitted Community Safety Reports in Tamil Nadu (Preserved & Moderated)
    this.reports = [
      {
        id: 'rep-1',
        userId: 'usr-demo-1',
        reporterName: 'Community Contributor',
        category: 'poor_lighting',
        severity: 'high',
        lat: 11.0195,
        lng: 76.9654,
        locationName: 'Cross Cut Road 7th Street corner, Gandhipuram, Coimbatore',
        description:
          'Streetlight outage reported between 7:30 PM and 10:30 PM near the 7th Street junction approaching Gandhipuram Bus Stand.',
        submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        status: 'verified',
        adminNotes: 'Moderator reviewed community observation for Gandhipuram corridor.'
      },
      {
        id: 'rep-3',
        userId: 'usr-demo-1',
        reporterName: 'Community Contributor',
        category: 'road_hazard',
        severity: 'medium',
        lat: 11.0268,
        lng: 76.9431,
        locationName: 'NSR Road, Saibaba Colony, Coimbatore',
        description:
          'Stormwater drain excavation along the pedestrian shoulder with partial barricading. Use main illuminated carriageway sidewalk.',
        submittedAt: new Date(Date.now() - 10 * 3600000).toISOString(),
        status: 'pending',
        adminNotes: 'Awaiting moderator review'
      }
    ];

    // 6. Saved Routes in Tamil Nadu
    this.savedRoutes = [
      {
        id: 'rt-saved-1',
        userId: 'usr-demo-1',
        name: 'Gandhipuram to R.S. Puram DB Road (Coimbatore)',
        fromName: 'Gandhipuram Central Bus Stand, Coimbatore',
        toName: 'R.S. Puram DB Road, Coimbatore',
        fromCoords: [11.0168, 76.9678],
        toCoords: [11.0112, 76.9458],
        preferredMode: 'walking',
        savedAt: new Date(Date.now() - 8 * 86400000).toISOString()
      },
      {
        id: 'rt-saved-2',
        userId: 'usr-demo-1',
        name: 'T. Nagar Bus Terminus to Adyar Signal (Chennai)',
        fromName: 'T. Nagar Bus Terminus, Chennai',
        toName: 'Adyar LB Road Signal, Chennai',
        fromCoords: [13.0418, 80.2341],
        toCoords: [13.0063, 80.2574],
        preferredMode: 'driving',
        savedAt: new Date(Date.now() - 3 * 86400000).toISOString()
      }
    ];

    // 7. Notifications
    this.notifications = [
      {
        id: 'notif-1',
        userId: 'usr-demo-1',
        title: 'Community Report Reviewed',
        message:
          'Your community safety report for Cross Cut Road, Gandhipuram has been reviewed and published to the Tamil Nadu Threat Radar.',
        type: 'report_status',
        read: false,
        createdAt: new Date(Date.now() - 18 * 3600000).toISOString()
      }
    ];

    // 8. Audit Logs
    this.auditLogs = [
      {
        id: 'aud-1',
        actorId: 'usr-admin-1',
        actorName: 'Safety Coordinator',
        action: 'VERIFY_COMMUNITY_REPORT',
        details: 'Community report #rep-1 reviewed for Gandhipuram, Coimbatore',
        ip: '127.0.0.1',
        timestamp: new Date(Date.now() - 18 * 3600000).toISOString()
      }
    ];
  }
}

export const db = new DatabaseStore();
