import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, EmergencyFacility, RouteOption } from '../types';
import { Navigation, Layers, Crosshair, MapPin } from 'lucide-react';

const createCustomIcon = (bgColor: string, borderColor: string, innerHtml: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${bgColor};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid ${borderColor};box-shadow:0 4px 14px rgba(0,0,0,0.75);color:#FAFAFA;font-weight:bold;font-size:13px;">${innerHtml}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// Calculate compass bearing (0° = North, 90° = East, 180° = South, 270° = West) between two [lat, lng] points
export const calculateBearing = (from: [number, number], to: [number, number]): number => {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const dLng = ((to[1] - from[1]) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

// Google Maps-style Live Position Navigation Arrow Marker (3D Navigation Chevron Arrow + Heading Cone + Pulsing Halo)
const createGMapTrackerIcon = (
  bearing: number,
  travelMode: 'foot' | 'bike' | 'car' = 'car',
  trackerStyle: 'arrow' | 'vehicle' = 'arrow'
) => {
  const modeLabel =
    travelMode === 'car' ? 'LIVE • CAR' : travelMode === 'bike' ? 'LIVE • BIKE' : 'LIVE • WALK';

  const innerGraphic =
    trackerStyle === 'vehicle' && travelMode === 'car'
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="transform: rotate(${bearing}deg); transition: transform 0.25s ease-out;">
          <path d="M12 1L15.5 5.5H8.5L12 1Z" fill="var(--theme-secondary, #FFD43B)" />
          <rect x="6.5" y="5.5" width="11" height="15.5" rx="4" fill="var(--theme-primary, #168BFF)" stroke="#FAFAFA" stroke-width="1.6"/>
          <path d="M8 9.2C8 8.3 8.8 7.8 9.6 7.8H14.4C15.2 7.8 16 8.3 16 9.2V11.5H8V9.2Z" fill="#09090B"/>
          <rect x="8.3" y="15.8" width="7.4" height="2.4" rx="1" fill="#09090B"/>
          <circle cx="8.5" cy="6.6" r="0.9" fill="#FEF08A"/>
          <circle cx="15.5" cy="6.6" r="0.9" fill="#FEF08A"/>
        </svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="transform: rotate(${bearing}deg); transition: transform 0.25s ease-out; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.75));">
          <!-- Google Maps 3D Navigation Arrow -->
          <path d="M12 2L20.5 20.5L12 16.2L3.5 20.5L12 2Z" fill="var(--theme-primary, #168BFF)" stroke="#FAFAFA" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M12 2L20.5 20.5L12 16.2V2Z" fill="var(--theme-secondary, #FFD43B)" fill-opacity="0.65"/>
        </svg>`;

  return L.divIcon({
    className: 'gmap-navigation-tracker-icon',
    html: `
      <div style="position:relative;width:68px;height:68px;display:flex;align-items:center;justify-content:center;">
        <!-- Rotating Directional Field-of-View Radar Cone -->
        <div style="position:absolute;inset:0;transform:rotate(${bearing}deg);transition:transform 0.25s ease-out;pointer-events:none;">
          <div style="width:0;height:0;margin:0 auto;border-left:20px solid transparent;border-right:20px solid transparent;border-bottom:32px solid rgba(22,139,255,0.34);filter:blur(1px);transform:translateY(-6px);"></div>
        </div>
        <!-- Pulsing GPS Accuracy Ring -->
        <div class="gmap-pulse-ring" style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(22,139,255,0.32);border:1.5px solid var(--theme-primary, #168BFF);pointer-events:none;"></div>
        <!-- Main Circular Navigation Puck -->
        <div style="position:relative;width:42px;height:42px;border-radius:50%;background:#18181B;border:2.5px solid #FAFAFA;box-shadow:0 6px 22px rgba(0,0,0,0.85), 0 0 0 4px rgba(22,139,255,0.28);display:flex;align-items:center;justify-content:center;z-index:2;">
          ${innerGraphic}
        </div>
        <!-- Live Position Badge -->
        <div style="position:absolute;bottom:-5px;background:#09090B;color:#FAFAFA;font-size:8px;font-weight:800;font-family:monospace;padding:1.5px 5px;border-radius:4px;border:1px solid var(--theme-primary, #168BFF);box-shadow:0 2px 6px rgba(0,0,0,0.9);z-index:3;letter-spacing:0.04em;white-space:nowrap;">
          ${modeLabel}
        </div>
      </div>
    `,
    iconSize: [68, 68],
    iconAnchor: [34, 34]
  });
};

// Directional Chevron Arrow along the active route polyline
const createRouteDirectionArrowIcon = (bearing: number, color: string) => {
  return L.divIcon({
    className: 'route-direction-arrow',
    html: `
      <div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;transform:rotate(${bearing}deg);pointer-events:none;">
        <div style="width:19px;height:19px;border-radius:50%;background:#09090B;border:1.5px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L20 19L12 15L4 19L12 3Z" fill="#FAFAFA"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Google Maps-Style Start (A) & Destination (B) Pin Markers (Draggable)
const createEndpointIcon = (type: 'start' | 'end', labelText: string, draggableHint = false) => {
  const isStart = type === 'start';
  const accent = isStart ? 'var(--theme-primary, #168BFF)' : '#22C55E';
  const tag = isStart ? 'START (A)' : 'DESTINATION (B)';
  const dragText = draggableHint ? ' • DRAG' : '';
  return L.divIcon({
    className: `route-endpoint-${type}`,
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:grab;">
        <!-- Floating Callout Pill -->
        <div style="background:#09090B;color:#FAFAFA;border:1.5px solid ${accent};padding:3px 8px;border-radius:8px;font-size:9px;font-weight:800;font-family:monospace;white-space:nowrap;box-shadow:0 6px 16px rgba(0,0,0,0.9);margin-bottom:4px;display:flex;align-items:center;gap:4px;">
          <span style="color:${accent};font-size:10px;">●</span>
          <span>${tag}: ${labelText}${dragText}</span>
        </div>
        <!-- Teardrop Map Pin -->
        <div style="position:relative;display:flex;align-items:center;justify-content:center;">
          ${
            !isStart
              ? `<div class="gmap-pulse-ring" style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(34,197,94,0.28);border:1px solid rgba(34,197,94,0.65);pointer-events:none;"></div>`
              : ''
          }
          <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${accent};border:2.5px solid #FAFAFA;box-shadow:0 6px 16px rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;">
            <span style="transform:rotate(45deg);color:#09090B;font-size:11px;font-weight:900;font-family:sans-serif;">
              ${isStart ? 'A' : 'B'}
            </span>
          </div>
        </div>
      </div>
    `,
    iconSize: [160, 58],
    iconAnchor: [80, 52]
  });
};

const policeIcon = createCustomIcon('#1E3A8A', '#60A5FA', 'P');
const hospitalIcon = createCustomIcon('#14532D', '#22C55E', 'H');
const pharmacyIcon = createCustomIcon('#065F46', '#22C55E', '+');
const incidentHighIcon = createCustomIcon('#991B1B', '#EF4444', '!');
const incidentModIcon = createCustomIcon('#92400E', '#F59E0B', '!');

export interface MapComponentProps {
  center: [number, number];
  zoom?: number;
  incidents?: Incident[];
  facilities?: EmergencyFacility[];
  routes?: RouteOption[];
  selectedRouteId?: string;
  onSelectRoute?: (routeId: string) => void;
  onMapClick?: (lat: number, lng: number, mode?: 'start' | 'end') => void;
  onStartDragEnd?: (lat: number, lng: number) => void;
  onEndDragEnd?: (lat: number, lng: number) => void;
  pinSelectionMode?: 'start' | 'end';
  onPinSelectionModeChange?: (mode: 'start' | 'end') => void;
  showHeatmap?: boolean;
  heatmapPoints?: {
    lat: number;
    lng: number;
    weight: number;
    type: string;
    title?: string;
    sourceName?: string;
    verificationStatus?: string;
  }[];
  interactive?: boolean;
  travelMode?: 'foot' | 'bike' | 'car';
  startCoords?: [number, number] | null;
  endCoords?: [number, number] | null;
  startLabel?: string;
  endLabel?: string;
  navigationPosition?: [number, number] | null;
  navigationBearing?: number;
  requireManualEndpoints?: boolean;
  [key: string]: any;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  center,
  zoom = 14,
  incidents = [],
  facilities = [],
  routes = [],
  selectedRouteId,
  onSelectRoute,
  onMapClick,
  onStartDragEnd,
  onEndDragEnd,
  pinSelectionMode: externalPinMode,
  onPinSelectionModeChange,
  showHeatmap = false,
  heatmapPoints = [],
  interactive = true,
  travelMode = 'car',
  startCoords,
  endCoords,
  startLabel = 'Origin',
  endLabel = 'Destination',
  navigationPosition,
  navigationBearing,
  requireManualEndpoints = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const lastFittedRouteKeyRef = useRef<string>('');

  const [mapStyle, setMapStyle] = useState<'dark' | 'street' | 'satellite'>('dark');
  const [trackerGraphic, setTrackerGraphic] = useState<'arrow' | 'vehicle'>('arrow');
  const [internalPinMode, setInternalPinMode] = useState<'start' | 'end'>('start');

  const activePinMode = externalPinMode || internalPinMode;
  const setPinMode = (mode: 'start' | 'end') => {
    setInternalPinMode(mode);
    if (onPinSelectionModeChange) onPinSelectionModeChange(mode);
  };

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onSelectRouteRef = useRef(onSelectRoute);
  onSelectRouteRef.current = onSelectRoute;
  const activePinModeRef = useRef(activePinMode);
  activePinModeRef.current = activePinMode;
  const onStartDragEndRef = useRef(onStartDragEnd);
  onStartDragEndRef.current = onStartDragEnd;
  const onEndDragEndRef = useRef(onEndDragEnd);
  onEndDragEndRef.current = onEndDragEnd;

  const getTileUrl = (style: 'dark' | 'street' | 'satellite') => {
    switch (style) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'street':
      case 'dark':
      default:
        return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  // Initialize Leaflet Map instance once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive
    });

    const tileLayer = L.tileLayer(getTileUrl('dark'), {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const overlayGroup = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng, activePinModeRef.current);
      }
    });

    mapRef.current = map;
    tileLayerRef.current = tileLayer;
    overlayGroupRef.current = overlayGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

  // Update tile layer URL when mapStyle changes
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(getTileUrl(mapStyle));
    }
  }, [mapStyle]);

  // Update map center & zoom when props change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, zoom, { animate: true });
    }
  }, [center[0], center[1], zoom]);

  // Render routes, Start/End pins, and Live Position Arrow
  useEffect(() => {
    const group = overlayGroupRef.current;
    const map = mapRef.current;
    if (!group) return;

    group.clearLayers();

    const activeRoute =
      routes.find(r => r.id === selectedRouteId) || (routes.length > 0 ? routes[0] : undefined);

    const hasBothManualEndpoints = Boolean(startCoords && endCoords);

    const routeCoords =
      activeRoute && activeRoute.coordinates.length >= 2
        ? activeRoute.coordinates
        : startCoords && endCoords
        ? [startCoords, endCoords]
        : [];

    const effectiveStart: [number, number] | null = startCoords
      ? startCoords
      : !requireManualEndpoints && routeCoords.length > 0
      ? routeCoords[0]
      : !requireManualEndpoints
      ? center
      : null;

    const effectiveEnd: [number, number] | null = endCoords
      ? endCoords
      : !requireManualEndpoints && routeCoords.length > 1
      ? routeCoords[routeCoords.length - 1]
      : null;

    const trackerPos: [number, number] | null =
      navigationPosition || effectiveStart || (!requireManualEndpoints ? center : null);

    let computedBearing = typeof navigationBearing === 'number' ? navigationBearing : 0;
    if (typeof navigationBearing !== 'number') {
      if (routeCoords.length > 1) {
        const nextPt =
          routeCoords.find(
            pt =>
              Math.abs(pt[0] - routeCoords[0][0]) > 0.00005 ||
              Math.abs(pt[1] - routeCoords[0][1]) > 0.00005
          ) || routeCoords[1];
        computedBearing = calculateBearing(routeCoords[0], nextPt);
      } else if (effectiveStart && effectiveEnd) {
        computedBearing = calculateBearing(effectiveStart, effectiveEnd);
      }
    }

    // 1. Render ALL Route Options (unselected options first, selected option on top)
    const routesToRender: RouteOption[] =
      routes.length > 0
        ? routes
        : effectiveStart && effectiveEnd
        ? [
            {
              id: 'direct-corridor',
              name: 'Option 1: Direct Corridor',
              distance: 0,
              duration: 0,
              safetyScore: 88,
              riskLevel: 'LOW',
              coordinates: [effectiveStart, effectiveEnd],
              segments: [],
              riskZones: []
            }
          ]
        : [];

    const activeId = selectedRouteId || activeRoute?.id || 'direct-corridor';
    const alternativeColors = ['#FFD43B', '#A855F7', '#38BDF8'];

    // Draw unselected routes first so the selected route sits cleanly on top
    const orderedRoutes = routesToRender
      .map((r, originalIdx) => ({ route: r, originalIdx }))
      .sort((a, b) => {
        const aSel = a.route.id === activeId ? 1 : 0;
        const bSel = b.route.id === activeId ? 1 : 0;
        return aSel - bSel;
      });

    orderedRoutes.forEach(({ route, originalIdx }) => {
      if (!route.coordinates || route.coordinates.length < 2) return;

      const isSelected = route.id === activeId;
      let riskColor = '#22C55E';
      if (route.riskLevel === 'HIGH' || route.riskLevel === 'CRITICAL') {
        riskColor = '#EF4444';
      } else if (route.riskLevel === 'MODERATE') {
        riskColor = '#F59E0B';
      }

      const altColor = alternativeColors[originalIdx % alternativeColors.length];
      const strokeColor = isSelected ? '#168BFF' : altColor;
      const mins = Math.max(1, Math.round((route.duration || 180) / 60));
      const km = route.distance ? (route.distance / 1000).toFixed(1) : '0.0';

      if (isSelected) {
        let closestIdx = 0;
        let minDist = Infinity;
        if (trackerPos) {
          route.coordinates.forEach((pt, idx) => {
            const d = Math.hypot(pt[0] - trackerPos[0], pt[1] - trackerPos[1]);
            if (d < minDist) {
              minDist = d;
              closestIdx = idx;
            }
          });
        }

        const traveledCoords =
          closestIdx > 0 ? route.coordinates.slice(0, closestIdx + 1) : [];
        const remainingCoords = route.coordinates.slice(closestIdx);

        // Outer safety-status glow halo along full route
        L.polyline(route.coordinates, {
          color: riskColor,
          weight: 14,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(group);

        // White road casing along full route
        L.polyline(route.coordinates, {
          color: '#FAFAFA',
          weight: 8,
          opacity: 0.5,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(group);

        if (traveledCoords.length >= 2) {
          L.polyline(traveledCoords, {
            color: '#A1A1AA',
            weight: 5,
            opacity: 0.75,
            dashArray: '4, 6',
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false
          }).addTo(group);
        }

        const aheadPoly = L.polyline(
          remainingCoords.length >= 2 ? remainingCoords : route.coordinates,
          {
            color: strokeColor,
            weight: 6,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round'
          }
        );

        aheadPoly.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectRouteRef.current) {
            onSelectRouteRef.current(route.id);
          }
        });

        aheadPoly.bindPopup(
          `<div style="padding:4px;">
            <div style="font-weight:700;font-size:13px;color:#FAFAFA;">Option ${originalIdx + 1}: ${route.name}</div>
            <div style="font-size:11px;color:${riskColor};margin-top:2px;">Safety Index: <strong>${route.safetyScore}%</strong> • ${mins} min (${km} km)</div>
            <div style="font-size:11px;color:#A1A1AA;margin-top:2px;">${
              route.classificationLabel || `${route.riskLevel} Risk Profile`
            }</div>
          </div>`
        );
        aheadPoly.addTo(group);

        const coords = route.coordinates;
        if (coords.length === 2) {
          const midPt: [number, number] = [
            (coords[0][0] + coords[1][0]) / 2,
            (coords[0][1] + coords[1][1]) / 2
          ];
          const segBearing = calculateBearing(coords[0], coords[1]);
          L.marker(midPt, {
            icon: createRouteDirectionArrowIcon(segBearing, strokeColor),
            interactive: false
          }).addTo(group);
        } else {
          const step = Math.max(1, Math.floor(coords.length / 7));
          for (let i = step; i < coords.length - 1; i += step) {
            const fromPt = coords[i - 1];
            const toPt = coords[i];
            const segBearing = calculateBearing(fromPt, toPt);
            L.marker(toPt, {
              icon: createRouteDirectionArrowIcon(segBearing, strokeColor),
              interactive: false
            }).addTo(group);
          }
        }
      } else {
        // Dark casing underneath alternative route so it stands out on any map tile
        L.polyline(route.coordinates, {
          color: '#09090B',
          weight: 8,
          opacity: 0.75,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(group);

        const altPoly = L.polyline(route.coordinates, {
          color: strokeColor,
          weight: 5,
          opacity: 0.9,
          dashArray: '8, 6',
          lineCap: 'round',
          lineJoin: 'round'
        });

        altPoly.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectRouteRef.current) {
            onSelectRouteRef.current(route.id);
          }
        });

        altPoly.bindTooltip(
          `Click to select Option ${originalIdx + 1} (${mins} min • ${route.safetyScore}% Safe)`,
          { sticky: true, direction: 'top' }
        );

        altPoly.addTo(group);
      }

      // Google Maps-style floating clickable route badge along each route option
      if (routesToRender.length >= 1 && route.coordinates.length >= 2) {
        const fractions = [0.5, 0.35, 0.65];
        const frac = fractions[originalIdx % fractions.length];
        const badgeIdx = Math.min(
          route.coordinates.length - 1,
          Math.max(0, Math.floor(route.coordinates.length * frac))
        );
        const badgeCoord = route.coordinates[badgeIdx];
        const badgeBg = isSelected ? '#168BFF' : '#11131A';
        const badgeBorder = isSelected ? '#FAFAFA' : strokeColor;
        const badgeTextColor = isSelected ? '#FFFFFF' : strokeColor;

        const badgeMarker = L.marker(badgeCoord, {
          zIndexOffset: isSelected ? 750 : 620 + originalIdx,
          icon: L.divIcon({
            className: 'route-option-pill-icon',
            html: `<div style="
              display:inline-flex;
              align-items:center;
              gap:5px;
              padding:3px 9px;
              border-radius:999px;
              background:${badgeBg};
              border:2px solid ${badgeBorder};
              color:${badgeTextColor};
              font-size:10px;
              font-weight:800;
              font-family:monospace;
              white-space:nowrap;
              box-shadow:0 4px 14px rgba(0,0,0,0.85);
              cursor:pointer;
              transform:translate(-50%, -50%);
            ">
              <span>Option ${originalIdx + 1}</span>
              <span style="opacity:0.85;">• ${mins}m</span>
              <span style="color:${isSelected ? '#FFD43B' : '#22C55E'};">${route.safetyScore}%</span>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          })
        });

        badgeMarker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectRouteRef.current) {
            onSelectRouteRef.current(route.id);
          }
        });

        badgeMarker.addTo(group);
      }
    });

    // 2. Draggable Start (A) & Destination (B) Markers (only render when set)
    if (effectiveStart) {
      const shortStart = (startLabel || 'Start Pin')
        .split(',')[0]
        .replace('Your Location (', '')
        .replace(')', '')
        .slice(0, 18);

      const startMarker = L.marker(effectiveStart, {
        icon: createEndpointIcon('start', shortStart || 'Origin', Boolean(onStartDragEndRef.current)),
        draggable: Boolean(onStartDragEndRef.current),
        zIndexOffset: 800
      });
      startMarker.on('dragend', () => {
        const ll = startMarker.getLatLng();
        if (onStartDragEndRef.current) {
          onStartDragEndRef.current(ll.lat, ll.lng);
        }
      });
      startMarker.bindPopup(
        `<div style="padding:4px;">
          <div style="font-size:10px;font-family:monospace;color:var(--theme-primary, #168BFF);text-transform:uppercase;">Start Marker (A)</div>
          <div style="font-weight:700;font-size:12px;color:#FAFAFA;margin-top:2px;">${startLabel || 'Selected Start Point'}</div>
          <div style="font-size:10px;color:#A1A1AA;font-family:monospace;margin-top:2px;">${effectiveStart[0].toFixed(4)}°N, ${effectiveStart[1].toFixed(4)}°E</div>
          <div style="font-size:10px;color:#22C55E;margin-top:4px;">Tip: Drag this marker on the map to adjust your Start point</div>
        </div>`
      );
      startMarker.addTo(group);
    }

    if (effectiveEnd) {
      const shortEnd = (endLabel || 'Destination Pin').split(',')[0].slice(0, 18);
      const endMarker = L.marker(effectiveEnd, {
        icon: createEndpointIcon('end', shortEnd || 'Destination', Boolean(onEndDragEndRef.current)),
        draggable: Boolean(onEndDragEndRef.current),
        zIndexOffset: 900
      });
      endMarker.on('dragend', () => {
        const ll = endMarker.getLatLng();
        if (onEndDragEndRef.current) {
          onEndDragEndRef.current(ll.lat, ll.lng);
        }
      });
      endMarker.bindPopup(
        `<div style="padding:4px;">
          <div style="font-size:10px;font-family:monospace;color:#22C55E;text-transform:uppercase;">Destination Marker (B)</div>
          <div style="font-weight:700;font-size:12px;color:#FAFAFA;margin-top:2px;">${endLabel || 'Selected Destination'}</div>
          <div style="font-size:10px;color:#A1A1AA;font-family:monospace;margin-top:2px;">${effectiveEnd[0].toFixed(4)}°N, ${effectiveEnd[1].toFixed(4)}°E</div>
          <div style="font-size:10px;color:#22C55E;margin-top:4px;">Tip: Drag this marker or click anywhere on the map to change destination</div>
        </div>`
      );
      endMarker.addTo(group);
    }

    if (map && routeCoords.length >= 2 && (hasBothManualEndpoints || !requireManualEndpoints)) {
      const allPoints = routesToRender.flatMap(r => r.coordinates);
      const routeKey = `${routesToRender.length}-${routeCoords[0][0].toFixed(4)}-${routeCoords[routeCoords.length - 1][0].toFixed(4)}`;
      if (lastFittedRouteKeyRef.current !== routeKey && allPoints.length >= 2) {
        lastFittedRouteKeyRef.current = routeKey;
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [65, 65], maxZoom: 16, animate: true });
      }
    }

    // 3. Google Maps-Style Live Position Navigation Arrow Marker
    if (trackerPos && (!requireManualEndpoints || effectiveStart)) {
      const trackerMarker = L.marker(trackerPos, {
        icon: createGMapTrackerIcon(computedBearing, travelMode, trackerGraphic),
        zIndexOffset: 1000
      });
      trackerMarker.bindPopup(
        `<div style="padding:4px;">
          <div style="font-weight:700;color:var(--theme-secondary, #FFD43B);font-size:13px;">Live GMap Navigation Arrow</div>
          <div style="font-size:11px;color:#FAFAFA;margin-top:2px;">
            Mode: <strong style="text-transform:uppercase;">${travelMode}</strong> • Heading: <strong>${Math.round(computedBearing)}°</strong>
          </div>
          <div style="font-size:11px;color:#A1A1AA;font-family:monospace;margin-top:2px;">
            ${trackerPos[0].toFixed(4)}°N, ${trackerPos[1].toFixed(4)}°E
          </div>
        </div>`
      );
      trackerMarker.addTo(group);
    }

    // 4. Emergency Facilities
    facilities.forEach(fac => {
      const iconToUse =
        fac.type === 'police'
          ? policeIcon
          : fac.type === 'pharmacy'
          ? pharmacyIcon
          : hospitalIcon;

      const label =
        fac.type === 'police'
          ? 'Tamil Nadu Police Facility'
          : fac.type === 'pharmacy'
          ? 'Verified Pharmacy'
          : 'Emergency Medical Facility';

      const distLine =
        typeof fac.distanceMeters === 'number'
          ? `<div style="font-size:11px;color:#22C55E;font-family:monospace;margin-top:4px;">Distance: ${(
              fac.distanceMeters / 1000
            ).toFixed(2)} km</div>`
          : '';

      const dialPhone = (fac.phone || '112').split('/')[0].trim();

      const marker = L.marker([fac.lat, fac.lng], { icon: iconToUse });
      marker.bindPopup(
        `<div style="padding:4px;min-width:210px;">
          <div style="font-size:10px;font-family:monospace;text-transform:uppercase;spacing:0.06em;color:#FFD43B;">${label}</div>
          <div style="font-weight:700;font-size:13px;color:#FAFAFA;margin-top:2px;">${fac.name}</div>
          <div style="font-size:11px;color:#A1A1AA;margin-top:3px;">${fac.address}</div>
          ${distLine}
          <div style="font-size:11px;color:#A1A1AA;margin-top:3px;">Source: <span style="color:#FAFAFA;">${
            fac.source || 'OpenStreetMap'
          }</span></div>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #303036;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11px;font-family:monospace;color:#FAFAFA;">${fac.phone}</span>
            <a href="tel:${dialPhone}" style="padding:4px 10px;border-radius:6px;background:var(--theme-primary, #168BFF);color:#FAFAFA;font-weight:700;font-size:11px;text-decoration:none;">Call Now</a>
          </div>
        </div>`
      );
      marker.addTo(group);
    });

    // 5. Threat Radar Observations (Exact Pins mode)
    if (!showHeatmap) {
      incidents.forEach(inc => {
        const badgeLabel =
          inc.isDemo || inc.verificationStatus === 'demo'
            ? 'DEMO SIMULATION'
            : inc.verificationStatus === 'verified_external'
            ? 'VERIFIED EXTERNAL DATA'
            : 'COMMUNITY REPORTED';

        const marker = L.marker([inc.lat, inc.lng], {
          icon: inc.severity >= 4 ? incidentHighIcon : incidentModIcon
        });
        marker.bindPopup(
          `<div style="padding:4px;max-width:240px;">
            <span style="display:inline-block;font-size:10px;font-family:monospace;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:rgba(22,139,255,0.16);color:#FFD43B;border:1px solid rgba(22,139,255,0.4);margin-bottom:5px;">
              ${badgeLabel}
            </span>
            <div style="font-weight:700;font-size:13px;color:#FAFAFA;">
              ${inc.title || inc.categoryLabel || inc.type.toUpperCase()}
            </div>
            <div style="font-size:11px;color:#A1A1AA;margin-top:4px;line-height:1.4;">
              ${inc.description}
            </div>
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #303036;font-size:10px;color:#A1A1AA;">
              <div><strong style="color:#FAFAFA;">Source:</strong> ${
                inc.sourceName || inc.source
              }</div>
              ${
                inc.areaName
                  ? `<div><strong style="color:#FAFAFA;">Area:</strong> ${inc.areaName}</div>`
                  : ''
              }
              <div><strong style="color:#FAFAFA;">Observed:</strong> ${new Date(
                inc.timestamp
              ).toLocaleString('en-IN')}</div>
            </div>
          </div>`
        );
        marker.addTo(group);
      });
    }

    // 6. Heatmap Intensity Circles
    if (showHeatmap) {
      heatmapPoints.forEach(pt => {
        const color =
          pt.weight >= 0.75 ? '#EF4444' : pt.weight >= 0.5 ? '#F59E0B' : '#22C55E';
        const circle = L.circle([pt.lat, pt.lng], {
          radius: pt.weight * 380,
          fillColor: color,
          fillOpacity: 0.32,
          color,
          weight: 1.5
        });
        if (pt.title) {
          circle.bindPopup(
            `<div style="padding:3px;">
              <div style="font-weight:700;font-size:12px;color:#FAFAFA;">${pt.title}</div>
              <div style="font-size:11px;color:#A1A1AA;">Source: ${pt.sourceName || 'Verified Feed'}</div>
            </div>`
          );
        }
        circle.addTo(group);
      });
    }
  }, [
    center,
    incidents,
    facilities,
    routes,
    selectedRouteId,
    showHeatmap,
    heatmapPoints,
    travelMode,
    startCoords,
    endCoords,
    startLabel,
    endLabel,
    navigationPosition,
    navigationBearing,
    trackerGraphic,
    requireManualEndpoints
  ]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    const activeRoute =
      routes.find(r => r.id === selectedRouteId) || (routes.length > 0 ? routes[0] : undefined);
    if (activeRoute && activeRoute.coordinates.length >= 2) {
      const bounds = L.latLngBounds(activeRoute.coordinates);
      mapRef.current.fitBounds(bounds, { padding: [65, 65], maxZoom: 16, animate: true });
    } else if (startCoords && endCoords) {
      const bounds = L.latLngBounds([startCoords, endCoords]);
      mapRef.current.fitBounds(bounds, { padding: [65, 65], maxZoom: 16, animate: true });
    } else {
      mapRef.current.setView(navigationPosition || startCoords || center, zoom, { animate: true });
    }
  };

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden border border-[#303036] shadow-2xl bg-[#09090B] ${
        mapStyle === 'dark' ? 'map-dark-tiles' : ''
      }`}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />

      {/* Minimal Step Prompt when Start or End is not yet chosen */}
      {requireManualEndpoints && (!startCoords || !endCoords) && (
        <div className="absolute top-3 left-14 right-36 z-[400] pointer-events-none flex justify-center">
          <div className="px-3.5 py-1.5 rounded-full bg-[#0D1117]/90 backdrop-blur-md border border-[#168BFF]/50 shadow-xl text-xs text-white flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
            <span>
              {!startCoords ? 'Tap map or search to set Start (A)' : 'Tap map or search to set Destination (B)'}
            </span>
          </div>
        </div>
      )}

      {/* Top-Right Compact Map Controls */}
      {interactive && (
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
          {(onMapClick || onStartDragEnd || onEndDragEnd) && (
            <div className="bg-[#18181B]/95 backdrop-blur-md p-1 rounded-xl border border-[#303036] shadow-xl grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setPinMode('start')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activePinMode === 'start'
                    ? 'bg-[#168BFF] text-white'
                    : 'bg-[#111114] text-[#A1A1AA] hover:text-white'
                }`}
                title="Place Start (A)"
              >
                <MapPin className="w-3 h-3" /> Pin A
              </button>
              <button
                type="button"
                onClick={() => setPinMode('end')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activePinMode === 'end'
                    ? 'bg-[#22C55E] text-[#09090B]'
                    : 'bg-[#111114] text-[#A1A1AA] hover:text-white'
                }`}
                title="Place Destination (B)"
              >
                <MapPin className="w-3 h-3" /> Pin B
              </button>
            </div>
          )}

          <div className="bg-[#18181B]/95 backdrop-blur-md p-1 rounded-xl border border-[#303036] shadow-xl flex flex-col gap-1">
            <button
              type="button"
              onClick={() =>
                setMapStyle(prev =>
                  prev === 'dark' ? 'street' : prev === 'street' ? 'satellite' : 'dark'
                )
              }
              className="px-2.5 py-1.5 text-white hover:bg-[#111114] rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-mono uppercase cursor-pointer"
              title="Switch Map Layer"
            >
              <Layers className="w-3.5 h-3.5 text-[#168BFF]" />
              <span>{mapStyle === 'dark' ? 'Dark' : mapStyle === 'street' ? 'Street' : 'Sat'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setTrackerGraphic(prev => (prev === 'arrow' ? 'vehicle' : 'arrow'))
              }
              className="px-2.5 py-1.5 text-white hover:bg-[#111114] rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-mono uppercase border-t border-[#303036] pt-1.5 cursor-pointer"
              title="Toggle Arrow / Vehicle"
            >
              <Navigation className="w-3.5 h-3.5 text-[#FFD43B]" />
              <span>{trackerGraphic === 'arrow' ? 'Arrow' : 'Car'}</span>
            </button>

            <button
              type="button"
              onClick={handleRecenter}
              className="px-2.5 py-1.5 text-white hover:bg-[#111114] rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-mono uppercase border-t border-[#303036] pt-1.5 cursor-pointer"
              title="Recenter Map"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Center</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Single-Line Legend Pill */}
      <div className="absolute bottom-3 left-3 z-[400] bg-[#18181B]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#303036] shadow-lg flex flex-wrap items-center gap-3 text-[10px] text-[#FAFAFA]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#168BFF]"></span> Start (A)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span> Dest (B)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#1E3A8A] border border-blue-400"></span> Police
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span> Alert
        </span>
      </div>
    </div>
  );
};
