import { TrustedContact, TravelMode } from '../types';

const CONTACTS_STORAGE_KEY = 'safecircle_real_contacts_v1';
const DEFAULT_CONTACT_ID_KEY = 'safecircle_default_whatsapp_contact_id_v1';
const TRAVELER_NAME_KEY = 'safecircle_traveler_name_v1';

/**
 * Formats a phone number into international digits required by https://wa.me/<number>
 * If a 10-digit number is provided (standard in India), prefixes '91'.
 */
export function formatPhoneForWhatsApp(rawPhone: string): string {
  const digitsOnly = (rawPhone || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  // If 10 digits starting with 6-9, prefix India country code 91
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return `91${digitsOnly}`;
  }
  // If 11 digits starting with 0, strip leading 0 and prefix 91
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `91${digitsOnly.slice(1)}`;
  }
  return digitsOnly;
}

/**
 * Formats a phone number for standard cellular phone dialing (tel: URI).
 * Preserves leading '+' or adds '+91' for 10-digit Indian mobile numbers.
 */
export function formatPhoneForTel(rawPhone: string): string {
  const trimmed = (rawPhone || '').trim();
  if (!trimmed) return '';
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `+91${digitsOnly.slice(1)}`;
  }
  if (trimmed.startsWith('+')) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }
  return digitsOnly;
}

/**
 * Builds a standard tel: URI for immediate normal cellular phone calls.
 */
export function buildTelUrl(rawPhone: string): string {
  const formatted = formatPhoneForTel(rawPhone);
  return formatted ? `tel:${formatted}` : 'tel:112';
}

/**
 * Programmatically initiates an immediate normal cellular phone call (tel:)
 * using a top-level anchor click so it works reliably on mobile and inside iframes.
 */
export function initiateImmediatePhoneCall(rawPhone: string): void {
  if (typeof document === 'undefined') return;
  const telUrl = buildTelUrl(rawPhone);
  try {
    const link = document.createElement('a');
    link.href = telUrl;
    link.target = '_top';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 300);
  } catch {
    window.location.href = telUrl;
  }
}

/**
 * Builds a real WhatsApp deep link (https://wa.me/<phone>?text=...) for sharing a live trip.
 * Includes:
 * 1. Exact current GPS pin on Google Maps
 * 2. Route directions from Origin to Destination on Google Maps
 * 3. Live SafeCircle Guardian Tracking URL
 * 4. Origin, Destination, Travel Mode, and ETA
 */
export function buildWhatsAppTripShareUrl(params: {
  contactPhone?: string;
  contactName?: string;
  travelerName?: string;
  startAddress: string;
  destAddress: string;
  currentCoords: [number, number];
  startCoords: [number, number];
  destCoords: [number, number];
  etaText: string;
  distanceText?: string;
  travelMode?: TravelMode;
  progressPercent?: number;
  shareUrl?: string;
}): string {
  const cleanPhone = params.contactPhone ? formatPhoneForWhatsApp(params.contactPhone) : '';
  const [curLat, curLng] = params.currentCoords;
  const [sLat, sLng] = params.startCoords;
  const [dLat, dLng] = params.destCoords;

  const liveGpsMapUrl = `https://www.google.com/maps?q=${curLat.toFixed(6)},${curLng.toFixed(6)}`;
  const routeDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${sLat.toFixed(6)},${sLng.toFixed(6)}&destination=${dLat.toFixed(6)},${dLng.toFixed(6)}`;

  const modeLabel =
    params.travelMode === 'walking'
      ? 'Walking'
      : params.travelMode === 'biking'
      ? 'Bike / Two-Wheeler'
      : 'Car';

  const greeting = params.contactName ? `Hi ${params.contactName}, ` : 'Hi, ';
  const sender = params.travelerName ? `*${params.travelerName}* is` : 'I am';

  const lines = [
    `🛡️ *LIVE FULL-TRIP LOCATION SHARING (SafeCircle)*`,
    `${greeting}${sender} travelling right now and sharing live continuous GPS tracking through the full trip:`,
    ``,
    `📍 *Start:* ${params.startAddress}`,
    `🏁 *Destination:* ${params.destAddress}`,
    `🚗 *Mode:* ${modeLabel}${params.distanceText ? ` (${params.distanceText})` : ''}`,
    `⏱️ *Estimated Time:* ${params.etaText}${
      typeof params.progressPercent === 'number' && params.progressPercent > 0
        ? ` (${Math.round(params.progressPercent)}% completed)`
        : ''
    }`
  ];

  if (params.shareUrl) {
    lines.push(
      ``,
      `🔴 *WATCH MY LIVE MOVEMENT THROUGH THE FULL TRIP (Auto-Updates Until Arrival):*`,
      `${params.shareUrl}`
    );
  }

  lines.push(
    ``,
    `📌 *Current Exact GPS Pin on Google Maps:*`,
    `${liveGpsMapUrl}`,
    ``,
    `🗺️ *Full Route Corridor on Google Maps:*`,
    `${routeDirectionsUrl}`
  );

  const encodedText = encodeURIComponent(lines.join('\n'));
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Builds a WhatsApp link for a quick "Safe Ping" check-in during navigation.
 */
export function buildWhatsAppSafePingUrl(params: {
  contactPhone?: string;
  contactName?: string;
  travelerName?: string;
  destAddress: string;
  currentCoords: [number, number];
  progressPercent: number;
  remainingTimeText: string;
  shareUrl?: string;
}): string {
  const cleanPhone = params.contactPhone ? formatPhoneForWhatsApp(params.contactPhone) : '';
  const [lat, lng] = params.currentCoords;
  const liveGpsMapUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  const lines = [
    `✅ *Live Trip Progress Update*`,
    `I am currently *${Math.round(params.progressPercent)}%* of the way to *${params.destAddress}*.`,
    `⏱️ *Remaining ETA:* ${params.remainingTimeText}`,
    params.shareUrl ? `🔴 *Follow Full Live Trip:* ${params.shareUrl}` : '',
    `📌 *Current GPS Location:* ${liveGpsMapUrl}`
  ].filter(Boolean);

  const encodedText = encodeURIComponent(lines.join('\n'));
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Builds a WhatsApp link for notifying a saved contact upon safe arrival at the destination.
 */
export function buildWhatsAppArrivalUrl(params: {
  contactPhone?: string;
  contactName?: string;
  travelerName?: string;
  destAddress: string;
  currentCoords: [number, number];
}): string {
  const cleanPhone = params.contactPhone ? formatPhoneForWhatsApp(params.contactPhone) : '';
  const [lat, lng] = params.currentCoords;
  const liveGpsMapUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  const greeting = params.contactName ? `Hi ${params.contactName}, ` : 'Hi, ';
  const lines = [
    `🏁 *ARRIVED SAFELY AT DESTINATION*`,
    `${greeting}I have reached *${params.destAddress}* safely!`,
    `📌 *Arrival GPS Pin:* ${liveGpsMapUrl}`
  ];

  const encodedText = encodeURIComponent(lines.join('\n'));
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Builds an Emergency SOS WhatsApp message with live GPS coordinates.
 */
export function buildWhatsAppSosUrl(params: {
  contactPhone?: string;
  contactName?: string;
  currentCoords: [number, number];
  address?: string;
}): string {
  const cleanPhone = params.contactPhone ? formatPhoneForWhatsApp(params.contactPhone) : '';
  const [lat, lng] = params.currentCoords;
  const liveGpsMapUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  const lines = [
    `🚨 *EMERGENCY SOS ALERT* 🚨`,
    `I need immediate help! Please check my live location and call me.`,
    params.address ? `📍 *Location:* ${params.address}` : '',
    `🌐 *Coordinates:* ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    `📌 *Open Exact GPS Location on Map:*`,
    `${liveGpsMapUrl}`
  ].filter(Boolean);

  const encodedText = encodeURIComponent(lines.join('\n'));
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Builds a native SMS URI (sms:<phone>?body=...) as a secondary option alongside WhatsApp.
 */
export function buildSmsTripShareUrl(params: {
  contactPhone: string;
  destAddress: string;
  currentCoords: [number, number];
  etaText: string;
}): string {
  const [lat, lng] = params.currentCoords;
  const body = `Live Trip Update: Heading to ${params.destAddress} (ETA: ${params.etaText}). My current GPS location: https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `sms:${params.contactPhone}?body=${encodeURIComponent(body)}`;
}

/**
 * LocalStorage helpers for persisting real manually saved contacts & default WhatsApp contact
 */
export function getLocalSavedContacts(): TrustedContact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalContacts(contacts: TrustedContact[]): void {
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  } catch {
    // ignore storage quota errors
  }
}

export function getDefaultWhatsAppContactId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_CONTACT_ID_KEY);
  } catch {
    return null;
  }
}

export function setDefaultWhatsAppContactId(contactId: string | null): void {
  try {
    if (contactId) {
      localStorage.setItem(DEFAULT_CONTACT_ID_KEY, contactId);
    } else {
      localStorage.removeItem(DEFAULT_CONTACT_ID_KEY);
    }
  } catch {}
}

export function getSavedTravelerName(): string {
  try {
    return localStorage.getItem(TRAVELER_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveTravelerName(name: string): void {
  try {
    localStorage.setItem(TRAVELER_NAME_KEY, name.trim());
  } catch {}
}
