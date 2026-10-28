import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  PhoneCall,
  ShieldAlert,
  X,
  Vibrate,
  Phone,
  Volume2,
  MessageCircle,
  UserPlus,
  Sparkles,
  CheckCircle2,
  Star
} from 'lucide-react';
import { api } from '../services/api';
import { EmergencyEvent, TrustedContact } from '../types';
import { FakeCallScreen } from './FakeCallScreen';
import { useEmergencyAlarm } from '../hooks/useEmergencyAlarm';
import {
  buildTelUrl,
  buildWhatsAppSosUrl,
  getDefaultWhatsAppContactId,
  getLocalSavedContacts,
  initiateImmediatePhoneCall,
  setDefaultWhatsAppContactId
} from '../utils/whatsappUtils';

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoords?: [number, number] | null;
}

// Safe wrapper for Vibration API
const triggerHaptic = (pattern: number | number[]) => {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Graceful fallback if vibration permission or hardware unavailable
  }
};

const stopHaptic = () => {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0);
    }
  } catch {}
};

const HOLD_DURATION_MS = 2000; // 2 seconds continuous hold for physical confirmation

export const SOSModal: React.FC<SOSModalProps> = ({ isOpen, onClose, currentCoords }) => {
  const [step, setStep] = useState<'confirm' | 'active'>('confirm');
  const [countdown, setCountdown] = useState<number>(3);
  const [isCountdownPaused, setIsCountdownPaused] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [sosEvent, setSosEvent] = useState<EmergencyEvent | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [showCancelInput, setShowCancelInput] = useState<boolean>(false);
  const [showFakeCall, setShowFakeCall] = useState<boolean>(false);
  const { isAlarming, startAlarm, stopAlarm } = useEmergencyAlarm();

  // Trusted Contacts & Immediate Normal Call state
  const [contacts, setContacts] = useState<TrustedContact[]>(() => getLocalSavedContacts());
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(() =>
    getDefaultWhatsAppContactId()
  );
  const [autoCallTrustedOnSos, setAutoCallTrustedOnSos] = useState<boolean>(true);
  const [showQuickAddContact, setShowQuickAddContact] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newContactRelation, setNewContactRelation] = useState<string>('Family');
  const [callStatusBanner, setCallStatusBanner] = useState<string | null>(null);

  // Hold-to-activate states
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const holdStartTimeRef = useRef<number | null>(null);
  const holdAnimFrameRef = useRef<number | null>(null);
  const lastVibeCheckpointRef = useRef<number>(0);

  const hasVibrationSupport = typeof window !== 'undefined' && 'vibrate' in navigator;

  // Load saved contacts whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const local = getLocalSavedContacts();
    setContacts(local);
    const defId = getDefaultWhatsAppContactId();
    if (defId && local.some((c) => c.id === defId)) {
      setPrimaryContactId(defId);
    } else if (local.length > 0) {
      setPrimaryContactId(local[0].id);
    }

    api
      .getContacts()
      .then((serverList) => {
        if (serverList && serverList.length > 0) {
          setContacts(serverList);
          const currentDef = getDefaultWhatsAppContactId();
          if (currentDef && serverList.some((c) => c.id === currentDef)) {
            setPrimaryContactId(currentDef);
          } else {
            setPrimaryContactId(serverList[0].id);
          }
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const primaryContact =
    contacts.find((c) => c.id === primaryContactId) ||
    contacts.find((c) => c.receiveSos) ||
    contacts[0] ||
    null;

  // Countdown loop with tactile feedback per second
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      isOpen &&
      step === 'confirm' &&
      countdown > 0 &&
      !isHolding &&
      !showFakeCall &&
      !isAlarming &&
      !isCountdownPaused &&
      !showQuickAddContact
    ) {
      timer = setTimeout(() => {
        triggerHaptic(50);
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (
      isOpen &&
      step === 'confirm' &&
      countdown === 0 &&
      !isHolding &&
      !isCountdownPaused &&
      !showQuickAddContact
    ) {
      triggerEmergency(autoCallTrustedOnSos);
    }
    return () => clearTimeout(timer);
  }, [
    isOpen,
    step,
    countdown,
    isHolding,
    showFakeCall,
    isAlarming,
    isCountdownPaused,
    showQuickAddContact,
    autoCallTrustedOnSos
  ]);

  // Clean up vibrations on close or unmount
  useEffect(() => {
    if (!isOpen) {
      stopHaptic();
      stopAlarm();
      setShowFakeCall(false);
      setHoldProgress(0);
      setIsHolding(false);
      setCountdown(3);
      setIsCountdownPaused(false);
      setCallStatusBanner(null);
      if (holdAnimFrameRef.current) cancelAnimationFrame(holdAnimFrameRef.current);
    }
  }, [isOpen]);

  if (showFakeCall) {
    return (
      <FakeCallScreen
        onEnd={() => setShowFakeCall(false)}
        currentCoords={currentCoords}
        startConnected={true}
      />
    );
  }

  if (!isOpen) return null;

  // Place an immediate normal cellular phone call to a trusted contact
  const handleImmediateNormalCall = (contact: { name: string; phone: string }) => {
    setIsCountdownPaused(true);
    triggerHaptic([100, 60, 150]);
    setCallStatusBanner(`Dialing normal call to ${contact.name} (${contact.phone})...`);
    initiateImmediatePhoneCall(contact.phone);
  };

  // Save a new trusted contact and immediately place a normal phone call to them
  const handleQuickSaveAndCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    try {
      const created = await api.addContact({
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
        relationship: newContactRelation,
        receiveSos: true,
        receiveJourney: true
      });
      const updated = [...contacts.filter((c) => c.id !== created.id), created];
      setContacts(updated);
      setPrimaryContactId(created.id);
      setDefaultWhatsAppContactId(created.id);
      setNewContactName('');
      setNewContactPhone('');
      setShowQuickAddContact(false);

      // Immediately place normal call to the newly saved trusted contact
      handleImmediateNormalCall({ name: created.name, phone: created.phone });
    } catch (err) {
      console.error('Failed to save contact in SOS:', err);
    }
  };

  // Execute emergency broadcast & optional immediate normal call to primary trusted contact
  const triggerEmergency = async (shouldCallPrimary = autoCallTrustedOnSos) => {
    stopHaptic();
    stopAlarm();
    triggerHaptic([200, 100, 350]);

    // If auto-call is enabled and a primary trusted contact exists, dial them immediately via normal phone call!
    if (shouldCallPrimary && primaryContact && primaryContact.phone) {
      setCallStatusBanner(
        `Calling Trusted Contact: ${primaryContact.name} (${primaryContact.phone})...`
      );
      initiateImmediatePhoneCall(primaryContact.phone);
    }

    setLoading(true);
    try {
      const lat = currentCoords ? currentCoords[0] : 11.0168;
      const lng = currentCoords ? currentCoords[1] : 76.9558;
      const res = await api.triggerSos(lat, lng);
      setSosEvent(res.event);
      setStep('active');
    } catch (err) {
      console.error('Failed to trigger SOS:', err);
      setStep('active');
    } finally {
      setLoading(false);
    }
  };

  // Start holding the emergency button
  const handleHoldStart = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (loading || step === 'active') return;

    setIsHolding(true);
    holdStartTimeRef.current = performance.now();
    lastVibeCheckpointRef.current = 0;

    triggerHaptic(40);

    const updateHoldProgress = (now: number) => {
      if (!holdStartTimeRef.current) return;
      const elapsed = now - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);

      if (progress >= 30 && lastVibeCheckpointRef.current < 30) {
        lastVibeCheckpointRef.current = 30;
        triggerHaptic([60, 40, 60]);
      } else if (progress >= 65 && lastVibeCheckpointRef.current < 65) {
        lastVibeCheckpointRef.current = 65;
        triggerHaptic([80, 30, 80, 30, 80]);
      } else if (progress >= 90 && lastVibeCheckpointRef.current < 90) {
        lastVibeCheckpointRef.current = 90;
        triggerHaptic([120, 20, 150]);
      }

      if (progress >= 100) {
        setIsHolding(false);
        holdStartTimeRef.current = null;
        triggerEmergency(true);
      } else {
        holdAnimFrameRef.current = requestAnimationFrame(updateHoldProgress);
      }
    };

    holdAnimFrameRef.current = requestAnimationFrame(updateHoldProgress);
  };

  // Release hold before completion
  const handleHoldEnd = () => {
    if (!isHolding) return;
    setIsHolding(false);
    holdStartTimeRef.current = null;
    if (holdAnimFrameRef.current) {
      cancelAnimationFrame(holdAnimFrameRef.current);
    }
    stopHaptic();
    setHoldProgress(0);
  };

  const handleCancelEmergency = async () => {
    if (!sosEvent) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await api.cancelSos(sosEvent.id, cancelReason || 'User reached safety or confirmed false alarm');
      triggerHaptic([40, 80, 40]);
      onClose();
      setStep('confirm');
      setCountdown(3);
      setSosEvent(null);
    } catch (err) {
      console.error('Failed to cancel SOS:', err);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const emergencyCoords: [number, number] = [
    sosEvent?.lat || currentCoords?.[0] || 11.0168,
    sosEvent?.lng || currentCoords?.[1] || 76.9558
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 select-none overflow-y-auto">
      <div className="bg-[#17181c] rounded-3xl max-w-lg w-full overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.85)] border border-white/15 text-[#f5f5f7] my-auto max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="bg-[#101114] border-b border-white/10 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff453a] animate-ping"></span>
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-[#f5f5f7]">
              Emergency SOS & Immediate Trusted Contact Call
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-[#f5f5f7] p-1.5 rounded-full transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Status Banner when Normal Call is Initiated */}
          {callStatusBanner && (
            <div className="bg-[#30d158]/15 border border-[#30d158]/40 rounded-2xl p-3 flex items-center justify-between text-xs text-[#30d158]">
              <div className="flex items-center space-x-2">
                <PhoneCall className="w-4 h-4 animate-bounce shrink-0" />
                <span className="font-bold">{callStatusBanner}</span>
              </div>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            </div>
          )}

          {/* ================================================================= */}
          {/* IMMEDIATE NORMAL CALL TO TRUSTED CONTACTS (Always Visible on Top) */}
          {/* ================================================================= */}
          <div className="bg-[#101114] border border-[#30d158]/35 rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PhoneCall className="w-4 h-4 text-[#30d158]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#30d158]">
                  Immediate Normal Call to Trusted Contact
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCountdownPaused(true);
                  setShowQuickAddContact(!showQuickAddContact);
                }}
                className="text-[11px] font-semibold text-[#64b5ff] hover:text-white flex items-center space-x-1 bg-[#0a84ff]/15 px-2.5 py-1 rounded-full border border-[#0a84ff]/30 transition"
              >
                <UserPlus className="w-3 h-3" />
                <span>{showQuickAddContact ? 'Close Form' : '+ Add Contact'}</span>
              </button>
            </div>

            {/* Quick Add Contact Form inside SOS */}
            {showQuickAddContact && (
              <form
                onSubmit={handleQuickSaveAndCall}
                className="bg-[#17181c] border border-white/10 rounded-2xl p-3 space-y-2.5"
              >
                <div className="text-[11px] font-bold text-white">
                  Save Trusted Contact & Place Immediate Normal Call
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Contact Name (e.g. Mom / Dad)"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full text-xs bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-[#a1a1aa]/60 focus:outline-hidden focus:border-[#30d158]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Mobile Number (e.g. 9876543210)"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full text-xs bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-[#a1a1aa]/60 focus:outline-hidden focus:border-[#30d158]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={newContactRelation}
                    onChange={(e) => setNewContactRelation(e.target.value)}
                    className="text-xs bg-[#101114] border border-white/15 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    <option value="Parent">Parent / Guardian</option>
                    <option value="Partner">Spouse / Partner</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#30d158] hover:bg-[#28b84c] text-black font-extrabold text-xs rounded-xl flex items-center space-x-1.5 shadow-md transition"
                  >
                    <PhoneCall className="w-3.5 h-3.5 fill-black" />
                    <span>Save & Call Now</span>
                  </button>
                </div>
              </form>
            )}

            {/* Primary Trusted Contact 1-Tap Immediate Normal Call Button */}
            {primaryContact ? (
              <div className="space-y-2.5">
                <a
                  href={buildTelUrl(primaryContact.phone)}
                  target="_top"
                  onClick={() =>
                    handleImmediateNormalCall({
                      name: primaryContact.name,
                      phone: primaryContact.phone
                    })
                  }
                  className="w-full py-3.5 px-4 bg-[#30d158] hover:bg-[#28b84c] active:scale-98 text-black font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center space-x-2.5 shadow-[0_8px_24px_rgba(48,209,88,0.35)] transition"
                >
                  <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 fill-black shrink-0" />
                  <span className="truncate">
                    CALL {primaryContact.name.toUpperCase()} NOW ({primaryContact.phone})
                  </span>
                </a>

                {/* All Saved Trusted Contacts List with Direct Normal Call & WhatsApp SOS */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {contacts.map((contact) => {
                    const isPrimary = contact.id === primaryContact.id;
                    return (
                      <div
                        key={contact.id}
                        className={`flex items-center justify-between text-xs p-2.5 rounded-xl border gap-2 ${
                          isPrimary
                            ? 'bg-[#30d158]/10 border-[#30d158]/30'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-white truncate">{contact.name}</span>
                            {isPrimary && (
                              <span className="text-[9px] bg-[#30d158]/20 text-[#30d158] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 shrink-0">
                                <Star className="w-2.5 h-2.5 fill-[#30d158]" />
                                Primary
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#a1a1aa] font-mono block">
                            {contact.phone}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {/* Direct Normal Cellular Phone Call */}
                          <a
                            href={buildTelUrl(contact.phone)}
                            target="_top"
                            onClick={() =>
                              handleImmediateNormalCall({
                                name: contact.name,
                                phone: contact.phone
                              })
                            }
                            className="px-3 py-1.5 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-extrabold rounded-xl text-[11px] flex items-center space-x-1 shadow-sm transition"
                            title={`Place immediate normal phone call to ${contact.name}`}
                          >
                            <Phone className="w-3.5 h-3.5 fill-white" />
                            <span>Call Now</span>
                          </a>

                          {/* WhatsApp SOS */}
                          <a
                            href={buildWhatsAppSosUrl({
                              contactPhone: contact.phone,
                              contactName: contact.name,
                              currentCoords: emergencyCoords,
                              address: sosEvent?.address
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setIsCountdownPaused(true)}
                            className="px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold rounded-xl text-[11px] flex items-center space-x-1 transition"
                            title={`Send WhatsApp SOS with live GPS to ${contact.name}`}
                          >
                            <MessageCircle className="w-3.5 h-3.5 fill-black" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Auto-call toggle */}
                {step === 'confirm' && (
                  <label className="flex items-center justify-between pt-1 text-[11px] text-[#a1a1aa] cursor-pointer">
                    <span className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={autoCallTrustedOnSos}
                        onChange={(e) => setAutoCallTrustedOnSos(e.target.checked)}
                        className="rounded border-white/20 bg-black text-[#30d158] focus:ring-[#30d158] w-3.5 h-3.5"
                      />
                      <span>
                        Auto-call <strong className="text-white">{primaryContact.name}</strong> when SOS countdown finishes
                      </span>
                    </span>
                  </label>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#a1a1aa] bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-between gap-2">
                <span>
                  Add your family or trusted friend's phone number to place immediate 1-tap normal calls during SOS.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCountdownPaused(true);
                    setShowQuickAddContact(true);
                  }}
                  className="px-3 py-1.5 bg-[#30d158] text-black font-bold rounded-xl text-xs shrink-0"
                >
                  Add Number
                </button>
              </div>
            )}
          </div>

          {step === 'confirm' ? (
            <div className="text-center py-1 space-y-4">
              {/* Circular Hold-to-Activate Button with Progress Ring */}
              <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    className="text-white/10 stroke-current"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    className="text-[#ff453a] stroke-current transition-all duration-75"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 52}
                    strokeDashoffset={2 * Math.PI * 52 * (1 - holdProgress / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                <button
                  onMouseDown={handleHoldStart}
                  onMouseUp={handleHoldEnd}
                  onMouseLeave={handleHoldEnd}
                  onTouchStart={handleHoldStart}
                  onTouchEnd={handleHoldEnd}
                  onTouchCancel={handleHoldEnd}
                  disabled={loading}
                  className={`absolute inset-3 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 shadow-md ${
                    isHolding
                      ? 'bg-[#d93025] text-white scale-95 shadow-inner'
                      : 'bg-[#ff453a] hover:bg-[#ff3b30] text-white shadow-[0_8px_24px_rgba(255,69,58,0.4)]'
                  }`}
                  title="Press and hold for 2 seconds to activate emergency protocol and call trusted contact"
                >
                  <ShieldAlert className={`w-7 h-7 mb-0.5 ${isHolding ? 'scale-110' : ''} transition-transform`} />
                  <span className="text-[11px] font-bold tracking-tight uppercase">
                    {isHolding ? 'HOLDING...' : 'HOLD FOR SOS'}
                  </span>
                  <span className="text-[10px] opacity-85 font-mono">
                    {isHolding
                      ? `${Math.round(holdProgress)}%`
                      : isCountdownPaused
                      ? 'Paused'
                      : `${countdown}s auto`}
                  </span>
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#f5f5f7] tracking-tight">
                  {isHolding
                    ? 'Dispatching SOS & Calling Contact...'
                    : primaryContact
                    ? `SOS + Immediate Call to ${primaryContact.name}`
                    : 'Hold Emergency Button to Dispatch SOS'}
                </h3>
                <p className="text-[#a1a1aa] text-xs mt-0.5 max-w-sm mx-auto leading-relaxed">
                  {isCountdownPaused
                    ? 'Countdown paused while you manage calls. Tap Instant Dispatch below anytime.'
                    : `Auto-dispatching in ${countdown}s, or tap any contact above to call immediately.`}
                </p>
              </div>

              {/* Deterrent Actions: Loud Siren Alarm & Live AI Voice Call Guardian */}
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCountdownPaused(true);
                    if (isAlarming) stopAlarm();
                    else startAlarm();
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold transition ${
                    isAlarming
                      ? 'bg-amber-500 text-black shadow-lg animate-pulse'
                      : 'bg-white/10 hover:bg-white/20 text-[#f5f5f7]'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isAlarming ? 'Stop 100dB Siren' : 'Sound 100dB Siren'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCountdownPaused(true);
                    setShowFakeCall(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#0a84ff]/20 hover:bg-[#0a84ff]/30 border border-[#0a84ff]/40 text-[#64b5ff] rounded-full text-xs font-bold transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0a84ff]" />
                  <span>Live AI Guardian Voice Call</span>
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                <button
                  type="button"
                  onClick={() => triggerEmergency(true)}
                  disabled={loading}
                  className="px-5 py-2.5 bg-[#ff453a] hover:bg-[#ff3b30] text-white font-bold rounded-full transition text-xs shadow-md flex items-center justify-center space-x-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>
                    {loading
                      ? 'Broadcasting...'
                      : primaryContact
                      ? `Instant SOS & Call ${primaryContact.name.split(' ')[0]}`
                      : 'Instant SOS Dispatch'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[#f5f5f7] font-medium rounded-full transition text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="bg-[#ff453a]/10 border border-[#ff453a]/30 rounded-2xl p-3.5 flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-[#ff453a] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-[#f5f5f7] block">
                    Emergency SOS Broadcast Active
                  </span>
                  <p className="text-[#a1a1aa] mt-0.5">
                    Live GPS Dispatched: {sosEvent?.address || 'Current Location'} (
                    {emergencyCoords[0].toFixed(4)}, {emergencyCoords[1].toFixed(4)})
                  </p>
                </div>
              </div>

              {/* National Emergency Police 112 & AI Voice Companion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <a
                  href="tel:112"
                  target="_top"
                  onClick={() => initiateImmediatePhoneCall('112')}
                  className="flex items-center justify-center space-x-2 bg-[#ff453a] hover:bg-[#ff3b30] text-white font-bold px-4 py-3 rounded-2xl transition text-xs shadow-md"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call 112 Police Control</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowFakeCall(true)}
                  className="flex items-center justify-center space-x-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-bold px-4 py-3 rounded-2xl transition text-xs shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Talk to AI Guardian on Speaker</span>
                </button>
              </div>

              {/* Cancel SOS / Mark Safe */}
              <div className="border-t border-white/10 pt-3">
                {!showCancelInput ? (
                  <button
                    onClick={() => setShowCancelInput(true)}
                    className="w-full text-center text-xs font-medium text-[#a1a1aa] hover:text-[#f5f5f7] py-1 transition"
                  >
                    Mark Myself Safe / Cancel SOS
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Optional reason (e.g. Arrived safely at destination)"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden focus:bg-white/10"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEmergency}
                        disabled={loading}
                        className="flex-1 bg-[#0a84ff] hover:bg-[#0077ed] text-white text-xs font-semibold py-2 rounded-xl transition"
                      >
                        Confirm Cancellation
                      </button>
                      <button
                        onClick={() => setShowCancelInput(false)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#f5f5f7] text-xs font-medium rounded-xl border border-white/10"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
