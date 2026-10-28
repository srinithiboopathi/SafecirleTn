import {
  Incident,
  EmergencyFacility,
  SafetyReport,
  RouteOption,
  UserProfile,
  AssistantLiveContext,
  TrustedContact
} from '../types';

export const api: {
  getSafetyScore(lat: number, lng: number): Promise<any>;
  reverseGeocode(lat: number, lng: number): Promise<any>;
  searchLocation(query: string): Promise<any>;
  getLiveRadar(lat: number, lng: number, radius?: number, includeDemo?: boolean): Promise<any>;
  getIncidents(lat?: number, lng?: number, radius?: number, includeDemo?: boolean): Promise<Incident[]>;
  getFacilities(lat?: number, lng?: number): Promise<EmergencyFacility[]>;
  getHeatmapData(lat?: number, lng?: number, includeDemo?: boolean): Promise<any>;
  analyzeRoutes(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    mode?: string
  ): Promise<{
    routes?: RouteOption[];
    recommendedRouteId?: string;
    outOfBounds?: boolean;
    error?: string;
  }>;
  getSavedRoutes(): Promise<any>;
  getReports(): Promise<SafetyReport[]>;
  submitReport(report: Partial<SafetyReport>): Promise<any>;
  triggerSOS(lat: number, lng: number): Promise<any>;
  queryAssistant(
    prompt: string,
    latOrOpts?: number | any,
    lng?: number,
    lang?: string
  ): Promise<{
    response: string;
    answer?: string;
    liveContext?: AssistantLiveContext;
    timestamp: string;
  }>;
  getUserProfile(): Promise<UserProfile>;
  addEmergencyContact(contact: { name: string; phone: string; relation: string }): Promise<any>;
  deleteEmergencyContact(id: string): Promise<any>;
  getDataSources(lat?: number, lng?: number): Promise<any>;
  [key: string]: (...args: any[]) => Promise<any>;
} = {
  async getSafetyScore(lat: number, lng: number) {
    const res = await fetch('/api/safety/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, timestamp: new Date().toISOString() })
    });
    return res.json();
  },

  async reverseGeocode(lat: number, lng: number) {
    const res = await fetch('/api/location/ReverseGeocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    });
    return res.json();
  },

  async searchLocation(query: string) {
    const res = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },

  async getLiveRadar(
    lat: number,
    lng: number,
    radius: number = 8000,
    includeDemo: boolean = false
  ) {
    const res = await fetch(
      `/api/radar/live?lat=${lat}&lng=${lng}&radius=${radius}&includeDemo=${includeDemo}`
    );
    return res.json();
  },

  async getIncidents(
    lat?: number,
    lng?: number,
    radius?: number,
    includeDemo: boolean = false
  ): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set('lat', String(lat));
    if (lng !== undefined) params.set('lng', String(lng));
    if (radius !== undefined) params.set('radius', String(radius));
    if (includeDemo) params.set('includeDemo', 'true');
    const url = `/api/safety/incidents?${params.toString()}`;
    const res = await fetch(url);
    return res.json();
  },

  async getFacilities(lat?: number, lng?: number): Promise<EmergencyFacility[]> {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set('lat', String(lat));
    if (lng !== undefined) params.set('lng', String(lng));
    const res = await fetch(`/api/safety/facilities?${params.toString()}`);
    return res.json();
  },

  async getHeatmapData(lat?: number, lng?: number, includeDemo: boolean = false) {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set('lat', String(lat));
    if (lng !== undefined) params.set('lng', String(lng));
    if (includeDemo) params.set('includeDemo', 'true');
    const res = await fetch(`/api/safety/heatmap?${params.toString()}`);
    return res.json();
  },

  async analyzeRoutes(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    mode: string = 'foot'
  ) {
    const res = await fetch('/api/routes/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, mode, timestamp: new Date().toISOString() })
    });
    return res.json();
  },

  async getSavedRoutes() {
    const res = await fetch('/api/routes/saved');
    return res.json();
  },

  async getReports(): Promise<SafetyReport[]> {
    const res = await fetch('/api/reports');
    return res.json();
  },

  async submitReport(report: Partial<SafetyReport>) {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit safety report');
    }
    return data;
  },

  async triggerSOS(lat: number, lng: number) {
    const res = await fetch('/api/sos/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    });
    return res.json();
  },

  async queryAssistant(
    prompt: string,
    latOrOpts?: number | any,
    lng?: number,
    lang: string = 'ta'
  ) {
    let latNum = 11.0168;
    let lngNum = 76.9558;
    let langCode: string = lang || 'ta';
    if (typeof latOrOpts === 'number') {
      latNum = latOrOpts;
      if (typeof lng === 'number') lngNum = lng;
    } else if (latOrOpts && typeof latOrOpts === 'object') {
      if (Array.isArray(latOrOpts.userCoords)) {
        latNum = Number(latOrOpts.userCoords[0]) || 11.0168;
        lngNum = Number(latOrOpts.userCoords[1]) || 76.9558;
      }
      if (latOrOpts.lang) {
        langCode = String(latOrOpts.lang);
      }
    }
    const res = await fetch('/api/assistant/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, lat: latNum, lng: lngNum, lang: langCode })
    });
    return res.json();
  },

  async getUserProfile(): Promise<UserProfile> {
    const res = await fetch('/api/user/profile');
    return res.json();
  },

  async addEmergencyContact(contact: { name: string; phone: string; relation: string }) {
    const res = await fetch('/api/user/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    });
    return res.json();
  },

  async deleteEmergencyContact(id: string) {
    const res = await fetch(`/api/user/contacts/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async getDataSources(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set('lat', String(lat));
    if (lng !== undefined) params.set('lng', String(lng));
    const res = await fetch(`/api/safety/sources?${params.toString()}`);
    return res.json();
  },

  // Compatibility aliases for TrustedContactsPage / JourneySharingPage
  async getContacts(): Promise<TrustedContact[]> {
    const profile = await this.getUserProfile();
    return (profile?.emergencyContacts || []).map(c => ({
      ...c,
      relationship: c.relation
    }));
  },

  async addContact(contact: Partial<TrustedContact>) {
    const res = await this.addEmergencyContact({
      name: contact.name || '',
      phone: contact.phone || '',
      relation: contact.relationship || contact.relation || 'Trusted Contact'
    });
    return res.added || contact;
  },

  async updateContact(id: string, contact: Partial<TrustedContact>) {
    return { id, ...contact };
  },

  async deleteContact(id: string) {
    return this.deleteEmergencyContact(id);
  }
};
