import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  UserPlus,
  Star,
  Trash2,
  Phone,
  CheckCircle2,
  Copy,
  MapPin,
  Clock,
  Navigation,
  Edit2,
  ExternalLink,
  Share2,
  Send
} from 'lucide-react';
import { api } from '../services/api';
import { TrustedContact, TravelMode, JourneySession } from '../types';
import {
  buildWhatsAppTripShareUrl,
  buildSmsTripShareUrl,
  getDefaultWhatsAppContactId,
  setDefaultWhatsAppContactId,
  getSavedTravelerName,
  saveTravelerName
} from '../utils/whatsappUtils';

interface ShareLiveTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  startAddress: string;
  destAddress: string;
  startCoords: [number, number];
  destCoords: [number, number];
  currentCoords: [number, number];
  etaMinutes: number;
  etaText: string;
  distanceText: string;
  travelMode: TravelMode;
  routeCoordinates?: [number, number][];
  progressPercent?: number;
  remainingMeters?: number;
  remainingSeconds?: number;
  existingSession?: JourneySession | null;
  onSessionCreated?: (session: JourneySession) => void;
  onStartFullTripNavigation?: () => void;
  onOpenFullJourneyPage?: (session: JourneySession) => void;
}

export const ShareLiveTripModal: React.FC<ShareLiveTripModalProps> = ({
  isOpen,
  onClose,
  startAddress,
  destAddress,
  startCoords,
  destCoords,
  currentCoords,
  etaMinutes,
  etaText,
  distanceText,
  travelMode,
  routeCoordinates,
  progressPercent = 0,
  remainingMeters,
  remainingSeconds,
  existingSession,
  onSessionCreated,
  onStartFullTripNavigation,
  onOpenFullJourneyPage
}) => {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [defaultContactId, setDefaultContactIdState] = useState<string | null>(getDefaultWhatsAppContactId());
  const [travelerName, setTravelerName] = useState<string>(getSavedTravelerName());
  const [activeSession, setActiveSession] = useState<JourneySession | null>(existingSession || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Manual Contact Form State
  const [showContactForm, setShowContactForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactRelationship, setContactRelationship] = useState<string>('Family');
  const [makeDefault, setMakeDefault] = useState<boolean>(true);
  const [savingContact, setSavingContact] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadDataAndStartSession();
  }, [isOpen, startAddress, destAddress, startCoords[0], startCoords[1], destCoords[0], destCoords[1]]);

  const loadDataAndStartSession = async () => {
    setLoading(true);
    try {
      const savedList = await api.getContacts();
      setContacts(savedList);

      const storedDefId = getDefaultWhatsAppContactId();
      if (storedDefId && savedList.some((c) => c.id === storedDefId)) {
        setDefaultContactIdState(storedDefId);
      } else if (savedList.length > 0) {
        setDefaultContactIdState(savedList[0].id);
        setDefaultWhatsAppContactId(savedList[0].id);
      } else {
        setDefaultContactIdState(null);
        setShowContactForm(true); // Automatically open add form if no contacts saved yet
      }

      if (existingSession && existingSession.status === 'in_progress') {
        setActiveSession(existingSession);
        return;
      }

      // Create or fetch active real-time journey session so the live link works immediately across the full trip
      const session = await api.startJourney({
        startAddress,
        destAddress,
        startCoords,
        destCoords,
        currentCoords,
        etaMinutes: Math.max(1, etaMinutes),
        travelerName: travelerName || 'Traveler',
        sharedContactIds: savedList.map((c) => c.id),
        travelMode,
        progressPercent,
        remainingMeters,
        remainingSeconds,
        routeCoordinates
      });
      setActiveSession(session);
      if (onSessionCreated) {
        onSessionCreated(session);
      }
    } catch (err) {
      console.error('Failed to initialize live trip sharing session:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const shareUrl = activeSession
    ? `${window.location.origin}/#share-${activeSession.token}`
    : `${window.location.origin}`;

  const defaultContact =
    contacts.find((c) => c.id === defaultContactId) || contacts[0] || null;

  const handleSaveManualContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;

    setSavingContact(true);
    try {
      if (travelerName.trim()) {
        saveTravelerName(travelerName.trim());
      }

      if (editingId) {
        const updated = await api.updateContact(editingId, {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relationship: contactRelationship,
          receiveSos: true,
          receiveJourney: true
        });
        const nextList = contacts.map((c) => (c.id === editingId ? updated : c));
        setContacts(nextList);
        if (makeDefault) {
          setDefaultContactIdState(updated.id);
          setDefaultWhatsAppContactId(updated.id);
        }
        setStatusBanner(`Updated contact "${updated.name}" (${updated.phone})`);
      } else {
        const created = await api.addContact({
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relationship: contactRelationship,
          receiveSos: true,
          receiveJourney: true
        });
        const nextList = [...contacts, created];
        setContacts(nextList);
        if (makeDefault || nextList.length === 1) {
          setDefaultContactIdState(created.id);
          setDefaultWhatsAppContactId(created.id);
        }
        setStatusBanner(`Saved "${created.name}" (${created.phone}) for real WhatsApp trip sharing`);
      }

      setContactName('');
      setContactPhone('');
      setContactRelationship('Family');
      setEditingId(null);
      setShowContactForm(false);
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err) {
      console.error('Error saving contact:', err);
    } finally {
      setSavingContact(false);
    }
  };

  const handleEditContact = (c: TrustedContact) => {
    setEditingId(c.id);
    setContactName(c.name);
    setContactPhone(c.phone);
    setContactRelationship(c.relationship || 'Family');
    setMakeDefault(c.id === defaultContactId);
    setShowContactForm(true);
  };

  const handleDeleteContact = async (id: string) => {
    await api.deleteContact(id);
    const remaining = contacts.filter((c) => c.id !== id);
    setContacts(remaining);
    if (defaultContactId === id) {
      const nextDef = remaining[0]?.id || null;
      setDefaultContactIdState(nextDef);
      setDefaultWhatsAppContactId(nextDef);
    }
    if (remaining.length === 0) {
      setShowContactForm(true);
    }
  };

  const handleSelectDefault = (id: string) => {
    setDefaultContactIdState(id);
    setDefaultWhatsAppContactId(id);
    const found = contacts.find((c) => c.id === id);
    if (found) {
      setStatusBanner(`${found.name} set as default WhatsApp contact`);
      setTimeout(() => setStatusBanner(null), 3000);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const getWhatsAppHref = (contact?: TrustedContact | null) =>
    buildWhatsAppTripShareUrl({
      contactPhone: contact?.phone,
      contactName: contact?.name,
      travelerName: travelerName.trim() || undefined,
      startAddress,
      destAddress,
      currentCoords,
      startCoords,
      destCoords,
      etaText,
      distanceText,
      travelMode,
      progressPercent,
      shareUrl
    });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#141519] border border-white/15 rounded-3xl max-w-lg w-full overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.85)] text-[#f5f5f7] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#101114] px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366]">
              <MessageCircle className="w-5 h-5 fill-[#25D366]/20" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Live Location Sharing Through Full Trip
              </h2>
              <p className="text-[11px] text-[#a1a1aa]">
                Continuous real-time GPS tracking from start to destination via WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#a1a1aa] hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Status Toast */}
          {statusBanner && (
            <div className="bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] px-3.5 py-2.5 rounded-2xl text-xs font-medium flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusBanner}</span>
            </div>
          )}

          {/* Trip Summary Pill with Full-Trip Progress Bar */}
          <div className="bg-[#1b1c22] border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#30d158] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#30d158] animate-ping" />
                Continuous Full-Trip Live Stream Active
              </span>
              <span className="text-[11px] font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-full">
                {etaText} · {distanceText}
              </span>
            </div>

            {/* Full-Trip Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Start Origin (0%)</span>
                <span className="text-[#30d158] font-bold">
                  {Math.round(progressPercent)}% Completed
                </span>
                <span>Destination (100%)</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0a84ff] via-[#30d158] to-[#25D366] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(6, Math.min(100, progressPercent))}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-[#a1a1aa] space-y-1 pt-0.5">
              <div className="truncate">
                <strong className="text-white">From:</strong> {startAddress}
              </div>
              <div className="truncate">
                <strong className="text-white">To:</strong> {destAddress}
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#64b5ff] font-mono pt-0.5">
                <span>Live GPS: {currentCoords[0].toFixed(5)}, {currentCoords[1].toFixed(5)}</span>
                <span className="text-emerald-400">● Auto-updates every 2.5s until arrival</span>
              </div>
            </div>
          </div>

          {/* Traveler Name Input (included in WhatsApp message) */}
          <div className="flex items-center gap-2 bg-[#101114] border border-white/10 rounded-2xl px-3.5 py-2">
            <span className="text-[11px] text-[#a1a1aa] font-semibold shrink-0">Your Name:</span>
            <input
              type="text"
              placeholder="Enter your name (shown in WhatsApp alert)"
              value={travelerName}
              onChange={(e) => {
                setTravelerName(e.target.value);
                saveTravelerName(e.target.value);
              }}
              className="w-full bg-transparent text-xs text-white placeholder-[#a1a1aa]/50 focus:outline-hidden"
            />
          </div>

          {/* DEFAULT WHATSAPP ONE-TAP SHARE CTA */}
          {defaultContact ? (
            <div className="bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/15 border border-[#25D366]/40 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
                  <span className="text-xs font-bold text-white">
                    Default WhatsApp Contact
                  </span>
                </div>
                <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full font-bold border border-[#25D366]/30">
                  {defaultContact.relationship}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white text-sm">{defaultContact.name}</div>
                  <div className="text-[#a1a1aa] font-mono text-xs">{defaultContact.phone}</div>
                </div>
                <a
                  href={`tel:${defaultContact.phone}`}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                  title={`Call ${defaultContact.name}`}
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>

              <a
                href={getWhatsAppHref(defaultContact)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 bg-[#25D366] hover:bg-[#20bd5a] active:scale-98 text-black font-extrabold py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-[#25D366]/25"
              >
                <MessageCircle className="w-4 h-4 fill-black text-black" />
                <span>Share Live Trip on WhatsApp to {defaultContact.name}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : null}

          {/* Saved Manual Contacts Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider">
                Saved Contacts ({contacts.length})
              </span>
              {!showContactForm && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setContactName('');
                    setContactPhone('');
                    setContactRelationship('Family');
                    setMakeDefault(contacts.length === 0);
                    setShowContactForm(true);
                  }}
                  className="flex items-center space-x-1 text-xs font-bold text-[#64b5ff] hover:text-white bg-[#0a84ff]/15 hover:bg-[#0a84ff]/25 border border-[#0a84ff]/30 px-2.5 py-1 rounded-xl transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>
              )}
            </div>

            {/* Manual Contact Add / Edit Form */}
            {showContactForm && (
              <form
                onSubmit={handleSaveManualContact}
                className="bg-[#1b1c22] border border-[#0a84ff]/40 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {editingId ? 'Edit Saved Contact' : 'Save New Contact for Real Travelling'}
                  </span>
                  {contacts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowContactForm(false);
                        setEditingId(null);
                      }}
                      className="text-[11px] text-[#a1a1aa] hover:text-white"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                      Person's Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mom / Karthik / Priya"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-[#a1a1aa]/50 focus:outline-hidden focus:border-[#0a84ff]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[#a1a1aa] block mb-1">
                      WhatsApp / Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 9876543210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-[#a1a1aa]/50 focus:outline-hidden focus:border-[#0a84ff]"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] text-[#a1a1aa]">Relation:</label>
                    <select
                      value={contactRelationship}
                      onChange={(e) => setContactRelationship(e.target.value)}
                      className="bg-[#101114] border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
                    >
                      <option value="Family">Family / Parent</option>
                      <option value="Partner">Spouse / Partner</option>
                      <option value="Sibling">Brother / Sister</option>
                      <option value="Friend">Friend / Roommate</option>
                      <option value="Guardian">Guardian</option>
                    </select>
                  </div>

                  <label className="flex items-center space-x-2 text-xs text-[#f5f5f7] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={makeDefault}
                      onChange={(e) => setMakeDefault(e.target.checked)}
                      className="rounded border-white/20 bg-[#101114] text-[#25D366] focus:ring-[#25D366] w-3.5 h-3.5"
                    />
                    <span className="text-[11px]">Set as Default WhatsApp Contact</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingContact}
                  className="w-full bg-[#0a84ff] hover:bg-[#0077ed] text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md"
                >
                  {savingContact
                    ? 'Saving...'
                    : editingId
                    ? 'Update Contact Info'
                    : 'Save Contact Info'}
                </button>
              </form>
            )}

            {/* List of Saved Contacts */}
            {contacts.length === 0 ? (
              <div className="bg-[#101114] border border-white/10 rounded-2xl p-4 text-center text-xs text-[#a1a1aa]">
                No contacts saved yet. Enter a real person's name and WhatsApp number above to save them for instant live trip sharing.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {contacts.map((c) => {
                  const isDefault = c.id === defaultContact?.id;
                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                        isDefault
                          ? 'bg-[#1b1c22] border-[#25D366]/40'
                          : 'bg-[#101114] border-white/10'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white truncate">{c.name}</span>
                          <span className="text-[10px] text-[#a1a1aa] bg-white/5 px-2 py-0.5 rounded-full">
                            {c.relationship}
                          </span>
                          {isDefault && (
                            <span className="text-[9px] bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full font-bold">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#a1a1aa] font-mono mt-0.5">{c.phone}</div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* Direct WhatsApp Share for this contact */}
                        <a
                          href={getWhatsAppHref(c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition"
                          title={`Send live trip on WhatsApp to ${c.name}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-black" />
                          <span>WhatsApp</span>
                        </a>

                        {/* Direct SMS Share */}
                        <a
                          href={buildSmsTripShareUrl({
                            contactPhone: c.phone,
                            destAddress,
                            currentCoords,
                            etaText
                          })}
                          className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-semibold transition"
                          title={`Send SMS to ${c.name}`}
                        >
                          SMS
                        </a>

                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSelectDefault(c.id)}
                            className="p-1.5 text-[#a1a1aa] hover:text-[#25D366] hover:bg-white/10 rounded-lg transition"
                            title="Set as Default WhatsApp Contact"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleEditContact(c)}
                          className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-white/10 rounded-lg transition"
                          title="Edit contact"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-1.5 text-[#ff453a]/80 hover:text-[#ff453a] hover:bg-[#ff453a]/10 rounded-lg transition"
                          title="Delete contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Copyable Real Live Tracking Link & Open Anyone on WhatsApp */}
          <div className="bg-[#101114] border border-white/10 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">
                Live Tracking Link (Anyone Can View)
              </span>
              <a
                href={getWhatsAppHref(null)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#25D366] hover:underline font-semibold flex items-center space-x-1"
              >
                <MessageCircle className="w-3 h-3" />
                <span>Choose Any WhatsApp Chat</span>
              </a>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-[#a1a1aa] font-mono select-all"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition shrink-0 flex items-center space-x-1"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#101114] px-5 py-3.5 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-white rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>

          {activeSession && onOpenFullJourneyPage && (
            <button
              type="button"
              onClick={() => {
                onOpenFullJourneyPage(activeSession);
                onClose();
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Open Live Journey Dashboard</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
