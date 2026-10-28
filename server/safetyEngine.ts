import { db, SafetyIncident } from './db.ts';
import { getLiveThreatRadarData, severityToNumber } from './services/threatRadarCollector.ts';
import { isCoordinateInTamilNadu, resolveTamilNaduDistrict } from '../src/utils/tamilNaduGeo.ts';

export class SafetyEngine {
  static getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  static calculateLocationRisk(lat: number, lng: number, timestamp: string = new Date().toISOString()) {
    if (!isCoordinateInTamilNadu(lat, lng)) {
      return {
        outOfBounds: true,
        error:
          'SafeCircle AI supports Tamil Nadu, India exclusively. The requested coordinate lies outside Tamil Nadu.',
        safetyScore: 0,
        riskScore: 0,
        riskLevel: 'OUT_OF_REGION',
        confidence: 0,
        nearbyIncidentsCount: 0,
        nearestPoliceDistance: null,
        factors: {
          incidentImpact: 0,
          timeMultiplier: 1,
          isolationPenalty: 0,
          reportImpact: 0
        }
      };
    }

    const district = resolveTamilNaduDistrict(lat, lng);
    const date = new Date(timestamp);
    const hour = date.getHours();

    let incidentImpact = 0;
    let nearbyIncidentsCount = 0;
    const radius = 2000;

    const realIncidents = db.incidents.filter(
      inc => !inc.isDemo && inc.verificationStatus !== 'demo' && isCoordinateInTamilNadu(inc.lat, inc.lng)
    );

    realIncidents.forEach((inc: SafetyIncident) => {
      const dist = this.getDistance(lat, lng, inc.lat, inc.lng);
      if (dist <= radius) {
        nearbyIncidentsCount++;
        const distanceWeight = 1 - dist / radius;
        const incDate = new Date(inc.reportedDate || Date.now());
        const daysOld = Math.max(0, (date.getTime() - incDate.getTime()) / (1000 * 3600 * 24));
        const recencyWeight = Math.max(0.2, 1 - daysOld / 30);

        incidentImpact += severityToNumber(inc.severity) * 6 * distanceWeight * recencyWeight;
      }
    });

    let timeMultiplier = 1.0;
    if (hour >= 22 || hour <= 4) {
      timeMultiplier = 1.35;
    } else if (hour >= 19 || hour <= 6) {
      timeMultiplier = 1.15;
    }

    let minPoliceDist = Infinity;
    let minHospitalDist = Infinity;
    db.emergencyFacilities.forEach(fac => {
      if (!isCoordinateInTamilNadu(fac.lat, fac.lng)) return;
      const dist = this.getDistance(lat, lng, fac.lat, fac.lng);
      if (fac.type === 'police' && dist < minPoliceDist) {
        minPoliceDist = dist;
      }
      if (fac.type === 'hospital' && dist < minHospitalDist) {
        minHospitalDist = dist;
      }
    });

    let isolationPenalty = 0;
    if (minPoliceDist === Infinity) {
      isolationPenalty = 10;
    } else if (minPoliceDist > 4000) {
      isolationPenalty = 12;
    } else if (minPoliceDist > 2000) {
      isolationPenalty = 6;
    }

    let reportImpact = 0;
    db.reports.forEach(rep => {
      if (!isCoordinateInTamilNadu(rep.lat, rep.lng)) return;
      const dist = this.getDistance(lat, lng, rep.lat, rep.lng);
      if (dist <= 1500) {
        reportImpact += severityToNumber(rep.severity) * 4 * (1 - dist / 1500);
      }
    });

    const rawRisk = (incidentImpact + reportImpact + isolationPenalty) * timeMultiplier;
    const riskScore = Math.min(100, Math.round(rawRisk));
    const safetyScore = Math.max(5, 100 - riskScore);

    let riskLevel = 'LOW';
    if (safetyScore < 45) riskLevel = 'CRITICAL';
    else if (safetyScore < 65) riskLevel = 'HIGH';
    else if (safetyScore < 82) riskLevel = 'MODERATE';

    const hasNearbyBaselineFacility = minPoliceDist < 10000 || minHospitalDist < 10000;
    const confidence = hasNearbyBaselineFacility ? 88 : 65;

    return {
      outOfBounds: false,
      district: district.name,
      safetyScore,
      riskScore,
      riskLevel,
      confidence,
      nearbyIncidentsCount,
      nearestPoliceDistance: minPoliceDist === Infinity ? null : Math.round(minPoliceDist),
      factors: {
        incidentImpact: Math.round(incidentImpact),
        timeMultiplier,
        isolationPenalty,
        reportImpact: Math.round(reportImpact)
      }
    };
  }

  static async analyzeRouteAsync(
    coordinates: [number, number][],
    timestamp: string = new Date().toISOString()
  ) {
    if (!coordinates || coordinates.length === 0) {
      return { safetyScore: 0, riskLevel: 'UNKNOWN', segments: [], riskZones: [] };
    }

    const outOfBoundsPoint = coordinates.find(([lat, lng]) => !isCoordinateInTamilNadu(lat, lng));
    if (outOfBoundsPoint) {
      return {
        outOfBounds: true,
        error:
          'SafeCircle AI supports route safety analysis exclusively within Tamil Nadu, India. One or more route waypoints lie outside Tamil Nadu.',
        safetyScore: 0,
        riskLevel: 'OUT_OF_REGION',
        classificationLabel: 'Outside Tamil Nadu Coverage Area',
        confidence: 0,
        segments: [],
        riskZones: [],
        explanation: [
          'Selected origin, destination, or route corridor extends outside Tamil Nadu state boundaries.'
        ]
      };
    }

    const midIdx = Math.floor(coordinates.length / 2);
    const [midLat, midLng] = coordinates[midIdx];
    const startDistrict = resolveTamilNaduDistrict(coordinates[0][0], coordinates[0][1]);
    const endDistrict = resolveTamilNaduDistrict(
      coordinates[coordinates.length - 1][0],
      coordinates[coordinates.length - 1][1]
    );

    let liveRadar: Awaited<ReturnType<typeof getLiveThreatRadarData>> | null = null;
    try {
      liveRadar = await getLiveThreatRadarData(midLat, midLng, 8000, false);
    } catch {
      liveRadar = null;
    }

    const liveObservations = liveRadar?.observations || [];
    const liveFacilities = liveRadar?.facilities || [];
    const weatherMeta = liveRadar?.weather;

    const date = new Date(timestamp);
    const hour = date.getHours();
    const isNight = hour >= 19 || hour <= 5;

    let totalSafety = 0;
    const segments: any[] = [];
    const riskZones: any[] = [];
    let unlitEncounters = 0;
    let communityEncounters = 0;
    let safeHavenProximityCount = 0;

    const step = Math.max(1, Math.floor(coordinates.length / 24));
    let evaluatedPoints = 0;

    for (let i = 0; i < coordinates.length; i += step) {
      const [lat, lng] = coordinates[i];
      evaluatedPoints++;

      let pointPenalty = isNight ? 8 : 2;
      let pointBonus = 0;
      const localReasons: string[] = [];

      for (const obs of liveObservations) {
        const dist = this.getDistance(lat, lng, obs.lat, obs.lng);
        if (obs.type === 'weather_hazard' && dist <= 10000) {
          pointPenalty += obs.severity * 3;
          localReasons.push(obs.title);
        } else if (dist <= 450) {
          pointPenalty += obs.severity * 4.5;
          if (obs.type === 'lighting') unlitEncounters++;
          if (obs.sourceType === 'community_report') communityEncounters++;
          localReasons.push(obs.title);
        }
      }

      let nearestSafeDist = Infinity;
      for (const fac of liveFacilities) {
        const dist = this.getDistance(lat, lng, fac.lat, fac.lng);
        if (dist < nearestSafeDist) nearestSafeDist = dist;
      }

      if (nearestSafeDist <= 800) {
        pointBonus += 6;
        safeHavenProximityCount++;
      } else if (nearestSafeDist > 3500) {
        pointPenalty += 5;
      }

      const pointSafety = Math.max(25, Math.min(98, Math.round(100 - pointPenalty + pointBonus)));
      totalSafety += pointSafety;

      const pointRiskLevel =
        pointSafety < 55 ? 'HIGH' : pointSafety < 78 ? 'MODERATE' : 'LOW';

      if (i > 0) {
        const prev = coordinates[Math.max(0, i - step)];
        segments.push({
          start: prev,
          end: [lat, lng],
          safetyScore: pointSafety,
          riskLevel: pointRiskLevel
        });
      }

      if (pointSafety < 75 && localReasons.length > 0) {
        riskZones.push({
          location: [lat, lng],
          safetyScore: pointSafety,
          riskLevel: pointRiskLevel,
          reasons: Array.from(new Set(localReasons)).slice(0, 2)
        });
      }
    }

    const avgSafety = evaluatedPoints > 0 ? Math.round(totalSafety / evaluatedPoints) : 82;

    let overallRisk = 'LOW';
    let classificationLabel = 'Lower Assessed Risk (Available Data)';
    if (avgSafety < 55) {
      overallRisk = 'HIGH';
      classificationLabel = 'Elevated Risk Indicators';
    } else if (avgSafety < 80) {
      overallRisk = 'MODERATE';
      classificationLabel = 'Moderate Caution Advised';
    }

    const hasSufficientData = liveFacilities.length > 0 || liveObservations.length > 0;
    if (!hasSufficientData) {
      classificationLabel = 'Limited Data Coverage (Standard Route)';
    }

    const explanation: string[] = [];
    if (startDistrict.id === endDistrict.id) {
      explanation.push(
        `Corridor within ${startDistrict.name} District, Tamil Nadu (${startDistrict.policeCommissionerate}).`
      );
    } else {
      explanation.push(
        `Inter-district Tamil Nadu corridor: ${startDistrict.name} to ${endDistrict.name}.`
      );
    }

    if (liveFacilities.length > 0) {
      explanation.push(
        `Verified ${liveFacilities.length} emergency facilities (Police/Hospitals) mapped near this Tamil Nadu corridor.`
      );
    } else {
      explanation.push(
        'Limited OpenStreetMap emergency facility coverage along this corridor; exercise standard travel caution.'
      );
    }

    if (unlitEncounters > 0) {
      explanation.push(
        `Passes near ${unlitEncounters} OpenStreetMap segment(s) tagged with limited street lighting (lit=no).`
      );
    }
    if (communityEncounters > 0) {
      explanation.push(
        `Passes within 450m of ${communityEncounters} community-submitted safety observation(s).`
      );
    }
    if (weatherMeta && weatherMeta.conditionText) {
      explanation.push(`Current Tamil Nadu meteorological status: ${weatherMeta.conditionText}.`);
    }
    if (isNight) {
      explanation.push('Night-time transit multiplier applied (19:00–05:00 IST visibility factor).');
    }

    return {
      outOfBounds: false,
      safetyScore: avgSafety,
      riskLevel: overallRisk,
      classificationLabel,
      confidence: hasSufficientData ? 88 : 60,
      dataCoverageStatus: hasSufficientData ? 'sufficient' : 'limited',
      districts: {
        origin: startDistrict.name,
        destination: endDistrict.name
      },
      segments,
      riskZones,
      explanation,
      metrics: {
        mappedSafeHavensNearby: liveFacilities.length,
        unlitRoadEncounters: unlitEncounters,
        communityReportsNearby: communityEncounters,
        safeHavenCheckpoints: safeHavenProximityCount
      }
    };
  }
}
