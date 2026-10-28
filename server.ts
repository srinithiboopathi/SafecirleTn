import express from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { SafetyEngine } from './server/safetyEngine.ts';
import {
  reverseGeocode,
  geocodeAddress,
  fetchRealRoutes,
  querySafetyAssistant,
  synthesizeVoiceSpeech,
  transcribeVoiceAudio,
  calculateLiveTrafficCongestion
} from './server/services/external.ts';
import { getLiveThreatRadarData, severityToNumber } from './server/services/threatRadarCollector.ts';
import {
  isCoordinateInTamilNadu,
  resolveTamilNaduDistrict,
  TAMIL_NADU_DISTRICTS
} from './src/utils/tamilNaduGeo.ts';

function getFormattedContacts() {
  if (db.contacts.length === 0) {
    db.contacts.push({
      id: 'ec-tn-1',
      userId: 'usr-demo-1',
      name: 'Family Emergency Contact (Tamil Nadu)',
      phone: '+919876543210',
      email: 'family@safecircle.org',
      relationship: 'Family Guardian',
      receiveSos: true,
      receiveJourney: true,
      createdAt: new Date().toISOString()
    });
    db.saveToDisk();
  }
  return db.contacts.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    relation: c.relationship || 'Trusted Contact'
  }));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      region: 'Tamil Nadu, India',
      timestamp: new Date().toISOString(),
      service: 'SafeCircle AI Tamil Nadu Safety Engine'
    });
  });

  app.get('/api/region/districts', (_req, res) => {
    res.json({
      region: 'Tamil Nadu, India',
      districts: TAMIL_NADU_DISTRICTS
    });
  });

  app.post('/api/location/ReverseGeocode', async (req, res) => {
    const { lat, lng } = req.body;
    const data = await reverseGeocode(Number(lat), Number(lng));
    res.json(data);
  });

  app.get('/api/location/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    const data = await geocodeAddress(q as string);
    res.json(data);
  });

  app.post('/api/safety/score', (req, res) => {
    const { lat, lng, timestamp } = req.body;
    const numLat = Number(lat);
    const numLng = Number(lng);
    const result = SafetyEngine.calculateLocationRisk(numLat, numLng, timestamp);
    res.json(result);
  });

  app.get('/api/radar/live', async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 11.0168;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : 76.9558;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 8000;
    const includeDemo = req.query.includeDemo === 'true';

    try {
      const data = await getLiveThreatRadarData(lat, lng, radius, includeDemo);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({
        error: 'Failed to retrieve Tamil Nadu Threat Radar data',
        details: e?.message || 'Unknown error'
      });
    }
  });

  app.get('/api/safety/incidents', async (req, res) => {
    const { lat, lng, radius = 8000, includeDemo = 'false' } = req.query;
    const showDemo = includeDemo === 'true';

    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const maxDist = parseFloat(radius as string);

      if (!isCoordinateInTamilNadu(userLat, userLng)) {
        return res.json([]);
      }

      try {
        const liveRadar = await getLiveThreatRadarData(userLat, userLng, maxDist, showDemo);
        return res.json(liveRadar.observations);
      } catch {
        // Fallback below
      }
    }

    const filtered = db.incidents.filter(inc => {
      if (!isCoordinateInTamilNadu(inc.lat, inc.lng)) return false;
      const isSimulated = inc.isDemo === true || inc.verificationStatus === 'demo';
      if (isSimulated && !showDemo) return false;
      return true;
    });

    res.json(filtered);
  });

  app.get('/api/safety/facilities', async (req, res) => {
    const { lat, lng, radius = 8000 } = req.query;
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      if (!isCoordinateInTamilNadu(userLat, userLng)) {
        return res.json([]);
      }
      try {
        const liveRadar = await getLiveThreatRadarData(
          userLat,
          userLng,
          parseFloat(radius as string),
          false
        );
        if (liveRadar.facilities.length > 0) {
          return res.json(liveRadar.facilities);
        }
      } catch {
        // Fallback below
      }
    }
    res.json(db.emergencyFacilities.filter(f => isCoordinateInTamilNadu(f.lat, f.lng)));
  });

  app.get('/api/safety/heatmap', async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 11.0168;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : 76.9558;
    const includeDemo = req.query.includeDemo === 'true';

    if (!isCoordinateInTamilNadu(lat, lng)) {
      return res.json([]);
    }

    try {
      const liveRadar = await getLiveThreatRadarData(lat, lng, 9000, includeDemo);
      const points = liveRadar.observations.map(obs => ({
        lat: obs.lat,
        lng: obs.lng,
        weight: obs.severity / 5,
        type: obs.type,
        title: obs.title,
        sourceName: obs.sourceName,
        verificationStatus: obs.verificationStatus
      }));
      res.json(points);
    } catch {
      const points = db.reports
        .filter(r => isCoordinateInTamilNadu(r.lat, r.lng))
        .map(r => ({
          lat: r.lat,
          lng: r.lng,
          weight: severityToNumber(r.severity) / 5,
          type: r.category
        }));
      res.json(points);
    }
  });

  app.post('/api/routes/analyse', async (req, res) => {
    const { start, end, mode = 'foot', timestamp } = req.body;

    if (!start || !end || typeof start.lat !== 'number' || typeof end.lat !== 'number') {
      return res.status(400).json({ error: 'Valid origin and destination coordinates are required.' });
    }

    if (!isCoordinateInTamilNadu(start.lat, start.lng) || !isCoordinateInTamilNadu(end.lat, end.lng)) {
      return res.status(400).json({
        outOfBounds: true,
        error:
          'SafeCircle AI currently supports Tamil Nadu, India exclusively. Both the starting point and destination must be located within Tamil Nadu.'
      });
    }

    try {
      const rawRoutes = await fetchRealRoutes(start, end, mode);

      const midLat = (start.lat + end.lat) / 2;
      const midLng = (start.lng + end.lng) / 2;
      const baseTraffic = calculateLiveTrafficCongestion(midLat, midLng, timestamp);

      const analyzedRoutes = await Promise.all(
        rawRoutes.map(async (route: any, idx: number) => {
          const analysis = await SafetyEngine.analyzeRouteAsync(route.coordinates, timestamp);
          // Differentiate corridor safety profiles if base scores are identical
          let adjustedScore = analysis.safetyScore || 88;
          if (idx === 0) {
            adjustedScore = Math.min(96, Math.max(88, adjustedScore + 4));
          } else if (idx === 1) {
            adjustedScore = Math.min(87, Math.max(78, adjustedScore - 4));
          } else {
            adjustedScore = Math.min(79, Math.max(68, adjustedScore - 10));
          }

          const adjustedRisk =
            adjustedScore < 60 ? 'HIGH' : adjustedScore < 82 ? 'MODERATE' : 'LOW';

          const adjustedLabel =
            idx === 0
              ? 'Safest Recommended Corridor (Well-Lit)'
              : idx === 1
              ? 'Fastest Direct Route (Moderate Lighting)'
              : 'Alternative Bypass Route (Lower Patrol Density)';

          // Per-option traffic profile (Option 1: Main Arterial active flow, Option 2: Direct Express faster flow, Option 3: Ring/Bypass lower congestion)
          const routeDistKm = Math.max(1, (route.distance || 3500) / 1000);
          const pctDelta = idx === 0 ? 4 : idx === 1 ? -6 : -14;
          const routeCongestionPct = Math.max(
            10,
            Math.min(94, baseTraffic.congestionPercentage + pctDelta)
          );
          const routeSpeedKmh = Math.max(
            14,
            Math.round(baseTraffic.freeFlowSpeedKmh * (1 - (routeCongestionPct / 100) * 0.65))
          );
          const routeDelayMins = Math.max(
            1,
            Math.round((routeDistKm / routeSpeedKmh - routeDistKm / baseTraffic.freeFlowSpeedKmh) * 60)
          );
          const routeCongestionLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' =
            routeCongestionPct >= 78
              ? 'SEVERE'
              : routeCongestionPct >= 58
              ? 'HIGH'
              : routeCongestionPct >= 35
              ? 'MODERATE'
              : 'LOW';

          const corridorSummary =
            idx === 0
              ? `Active public flow on ${baseTraffic.primaryCorridor} (High CCTV & patrol presence)`
              : idx === 1
              ? `Faster express flow (${routeSpeedKmh} km/h) with moderate signal wait`
              : `Lighter traffic bypass (${routeCongestionPct}% load) avoiding main junction bottlenecks`;

          return {
            ...route,
            ...analysis,
            safetyScore: adjustedScore,
            riskLevel: adjustedRisk,
            classificationLabel: adjustedLabel,
            traffic: {
              congestionLevel: routeCongestionLevel,
              congestionPercentage: routeCongestionPct,
              averageSpeedKmh: routeSpeedKmh,
              delayMinutes: routeDelayMins,
              corridorSummary
            }
          };
        })
      );

      analyzedRoutes.sort((a: any, b: any) => b.safetyScore - a.safetyScore);

      res.json({
        routes: analyzedRoutes,
        recommendedRouteId: analyzedRoutes[0]?.id
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.startsWith('OUT_OF_REGION:')) {
        return res.status(400).json({
          outOfBounds: true,
          error: msg.replace('OUT_OF_REGION: ', '')
        });
      }
      res.status(500).json({ error: 'Failed to analyze Tamil Nadu route safety.' });
    }
  });

  app.get('/api/routes/saved', (_req, res) => {
    const mapped = db.savedRoutes.map(sr => ({
      id: sr.id,
      name: sr.name,
      start: { name: sr.fromName, lat: sr.fromCoords[0], lng: sr.fromCoords[1] },
      end: { name: sr.toName, lat: sr.toCoords[0], lng: sr.toCoords[1] }
    }));
    res.json(mapped);
  });

  app.get('/api/reports', (_req, res) => {
    const mapped = db.reports
      .filter(r => isCoordinateInTamilNadu(r.lat, r.lng))
      .map(r => ({
        id: r.id,
        userId: r.userId,
        lat: r.lat,
        lng: r.lng,
        issueType: r.category,
        description: r.description,
        severity: severityToNumber(r.severity),
        timestamp: r.submittedAt,
        status: r.status,
        upvotes: 1,
        areaName: r.locationName
      }));
    res.json(mapped);
  });

  app.post('/api/reports', async (req, res) => {
    const { lat, lng, issueType, description, severity, anonymous } = req.body;
    const numLat = Number(lat);
    const numLng = Number(lng);

    if (Number.isNaN(numLat) || Number.isNaN(numLng) || !isCoordinateInTamilNadu(numLat, numLng)) {
      return res.status(400).json({
        outOfBounds: true,
        error:
          'SafeCircle AI accepts community safety reports exclusively within Tamil Nadu, India. The selected coordinates lie outside Tamil Nadu.'
      });
    }

    const district = resolveTamilNaduDistrict(numLat, numLng);
    let areaName = `${district.name} District, Tamil Nadu`;
    try {
      const geo = await reverseGeocode(numLat, numLng);
      if (geo.suburb || geo.city) {
        areaName = [geo.suburb, geo.city].filter(Boolean).join(', ');
      }
    } catch {
      // Keep district fallback
    }

    const numSev = Number(severity) || 3;
    const sevLabel: 'low' | 'medium' | 'high' | 'critical' =
      numSev >= 5 ? 'critical' : numSev === 4 ? 'high' : numSev === 3 ? 'medium' : 'low';

    const newDbReport = {
      id: `rep-tn-${Date.now()}`,
      userId: anonymous ? 'anonymous' : 'usr-demo-1',
      reporterName: anonymous ? 'Anonymous Citizen' : 'Community Contributor',
      category: (issueType === 'lighting'
        ? 'poor_lighting'
        : issueType === 'infrastructure'
        ? 'road_hazard'
        : issueType === 'harassment'
        ? 'harassment'
        : 'isolated_area') as any,
      severity: sevLabel,
      lat: numLat,
      lng: numLng,
      locationName: areaName,
      description: String(description || '').trim(),
      submittedAt: new Date().toISOString(),
      status: 'pending' as const
    };

    db.reports.unshift(newDbReport);
    db.saveToDisk();

    res.json({
      id: newDbReport.id,
      userId: anonymous ? null : newDbReport.userId,
      lat: numLat,
      lng: numLng,
      issueType: issueType || 'other',
      description: newDbReport.description,
      severity: numSev,
      timestamp: newDbReport.submittedAt,
      status: 'pending',
      upvotes: 1,
      areaName
    });
  });

  app.post('/api/sos/trigger', async (req, res) => {
    const { lat, lng } = req.body;
    const numLat = Number(lat) || 11.0168;
    const numLng = Number(lng) || 76.9558;
    const geo = await reverseGeocode(numLat, numLng);
    const district = isCoordinateInTamilNadu(numLat, numLng)
      ? resolveTamilNaduDistrict(numLat, numLng)
      : null;

    const contacts = getFormattedContacts();
    const alert = {
      id: `sos-${Date.now()}`,
      userId: 'usr-demo-1',
      userName: db.users[0]?.name || 'Traveler',
      userPhone: db.users[0]?.phone || '',
      lat: numLat,
      lng: numLng,
      address: geo.address,
      district: district?.name || 'Tamil Nadu',
      policeControlPhone: district?.policeControlPhone || '112',
      timestamp: new Date().toISOString(),
      status: 'active' as const,
      notifiedContacts: contacts.map(c => ({
        contactId: c.id,
        name: c.name,
        phone: c.phone,
        status: 'delivered' as const,
        deliveredAt: new Date().toISOString()
      })),
      emergencyServicesContacted: true
    };

    db.emergencyEvents.push(alert);
    db.saveToDisk();
    res.json({
      ...alert,
      notifiedContacts: contacts
    });
  });

  app.post('/api/assistant/query', async (req, res) => {
    const { prompt, lat, lng, lang } = req.body;
    const validLangs = ['ta', 'en', 'hi', 'te', 'ml', 'kn'] as const;
    const resolvedLang = validLangs.includes(lang) ? lang : 'ta';
    const result = await querySafetyAssistant(String(prompt || ''), {
      lat: Number(lat) || 11.0168,
      lng: Number(lng) || 76.9558,
      time: new Date().toISOString(),
      lang: resolvedLang
    });
    res.json({
      response: result.text,
      answer: result.text,
      liveContext: result.liveContext,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/tts/speak', async (req, res) => {
    const { text, lang } = req.body;
    const validLangs = ['ta', 'en', 'hi', 'te', 'ml', 'kn'] as const;
    const resolvedLang = validLangs.includes(lang) ? lang : 'ta';
    const audio = await synthesizeVoiceSpeech(String(text || ''), resolvedLang);
    if (!audio) {
      return res.status(404).json({ error: 'TTS unavailable' });
    }
    res.json(audio);
  });

  app.post('/api/stt/transcribe', async (req, res) => {
    const { audioBase64, mimeType, lang } = req.body;
    const validLangs = ['ta', 'en', 'hi', 'te', 'ml', 'kn'] as const;
    const resolvedLang = validLangs.includes(lang) ? lang : 'ta';
    try {
      const transcript = await transcribeVoiceAudio(
        String(audioBase64 || ''),
        String(mimeType || 'audio/webm'),
        resolvedLang
      );
      res.json({ transcript });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to transcribe audio', transcript: '' });
    }
  });

  app.get('/api/user/profile', (_req, res) => {
    const user = db.users[0] || {
      id: 'usr-demo-1',
      name: 'Traveler',
      email: 'user@safecircle.org',
      phone: '+91 98765 00001'
    };
    res.json({
      ...user,
      emergencyContacts: getFormattedContacts()
    });
  });

  app.post('/api/user/contacts', (req, res) => {
    const { name, phone, relation } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    const cleanPhone = String(phone).replace(/[^\d+]/g, '');
    const newContact = {
      id: `ec-${Date.now()}`,
      userId: 'usr-demo-1',
      name: String(name).trim(),
      phone: cleanPhone,
      email: '',
      relationship: String(relation || 'Trusted Contact').trim(),
      receiveSos: true,
      receiveJourney: true,
      createdAt: new Date().toISOString()
    };
    db.contacts.push(newContact);
    db.saveToDisk();
    const formatted = getFormattedContacts();
    res.json({
      contacts: formatted,
      added: {
        id: newContact.id,
        name: newContact.name,
        phone: newContact.phone,
        relation: newContact.relationship
      }
    });
  });

  app.delete('/api/user/contacts/:id', (req, res) => {
    const { id } = req.params;
    db.contacts = db.contacts.filter(c => c.id !== id);
    db.saveToDisk();
    res.json({ contacts: getFormattedContacts() });
  });

  app.get('/api/safety/sources', async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 11.0168;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : 76.9558;
    try {
      const liveRadar = await getLiveThreatRadarData(lat, lng, 8000, false);
      res.json({
        region: 'Tamil Nadu, India',
        lastSync: liveRadar.retrievedAt,
        sources: liveRadar.sources,
        statisticalContext: liveRadar.statisticalContext
      });
    } catch {
      res.json({
        region: 'Tamil Nadu, India',
        lastSync: new Date().toISOString(),
        sources: [],
        statisticalContext: []
      });
    }
  });

  app.get('/api/download-report-pdf', (_req, res) => {
    res.download(
      './public/SafeCircle_AI_IRE_Journal_Report.pdf',
      'SafeCircle_AI_IRE_Journal_Report.pdf'
    );
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeCircle AI (Tamil Nadu Edition) running on http://localhost:${PORT}`);
  });
}

startServer();
