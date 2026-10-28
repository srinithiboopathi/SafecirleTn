import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { AssistantLiveContext } from '../types';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput';
import { BatteryConnectivityGuardian } from '../components/BatteryConnectivityGuardian';
import {
  SUPPORTED_VOICE_LANGUAGES,
  SupportedVoiceLang,
  getVoiceLanguageConfig,
  speakInVoice,
  stopAllVoicePlayback,
  startMultilingualMicSession,
  stopActiveMicSession,
  ActiveMicSession
} from '../utils/tamilVoice';
import {
  TAMIL_NADU_DISTRICTS,
  isCoordinateInTamilNadu,
  resolveTamilNaduDistrict
} from '../utils/tamilNaduGeo';
import {
  Bot,
  Send,
  User,
  Sparkles,
  ShieldAlert,
  Navigation,
  Phone,
  MapPin,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Building2,
  CloudRain,
  CheckCircle2,
  Languages,
  Car,
  Gauge,
  BatteryCharging
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  liveContext?: AssistantLiveContext;
}

export const AIAssistantPage: React.FC<{ userLocation: [number, number] }> = ({
  userLocation
}) => {
  const [selectedCoords, setSelectedCoords] = useState<[number, number]>(() =>
    isCoordinateInTamilNadu(userLocation[0], userLocation[1])
      ? userLocation
      : [11.0168, 76.9558]
  );
  const [placeQuery, setPlaceQuery] = useState('');
  const [voiceLang, setVoiceLang] = useState<SupportedVoiceLang>('en');

  const currentDistrict = resolveTamilNaduDistrict(selectedCoords[0], selectedCoords[1]);
  const langConfig = getVoiceLanguageConfig(voiceLang);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-tn',
      sender: 'ai',
      text: getVoiceLanguageConfig('en').welcomeGreeting(currentDistrict.name),
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestContext, setLatestContext] = useState<AssistantLiveContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveInterimText, setLiveInterimText] = useState('');
  const [micStatusHint, setMicStatusHint] = useState<string | null>(null);
  const [micFallbackOpen, setMicFallbackOpen] = useState(false);
  const [companionInput, setCompanionInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const micSessionRef = useRef<ActiveMicSession | null>(null);
  const voiceLangRef = useRef<SupportedVoiceLang>(voiceLang);
  voiceLangRef.current = voiceLang;
  const voiceModeActiveRef = useRef<boolean>(voiceModeActive);
  voiceModeActiveRef.current = voiceModeActive;
  const handleSendRef = useRef<(customPrompt?: string) => void>(() => {});

  const formatRecordingTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopAllVoicePlayback();
      stopActiveMicSession();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    api
      .queryAssistant(
        'Provide current location safety summary and nearest police and hospital.',
        selectedCoords[0],
        selectedCoords[1],
        voiceLang
      )
      .then(res => {
        if (mounted && res.liveContext) {
          setLatestContext(res.liveContext);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [selectedCoords]);

  const speakText = (
    text: string,
    msgId?: string,
    overrideLang?: SupportedVoiceLang
  ) => {
    const activeL = overrideLang || voiceLangRef.current;
    setSpeakingMsgId(msgId || null);
    speakInVoice(text, activeL, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      }
    });
  };

  const handleLanguageChange = (newLang: SupportedVoiceLang) => {
    stopActiveMicSession();
    micSessionRef.current = null;
    setIsListening(false);
    setIsTranscribing(false);
    setRecordingSeconds(0);
    setLiveInterimText('');
    setMicStatusHint(null);
    setVoiceLang(newLang);
    voiceLangRef.current = newLang;
    const cfg = getVoiceLanguageConfig(newLang);
    const greeting = cfg.welcomeGreeting(currentDistrict.name);
    const msgId = `lang-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: msgId,
        sender: 'ai',
        text: greeting,
        timestamp: new Date().toISOString()
      }
    ]);
    if (autoSpeakReplies || voiceModeActiveRef.current) {
      speakText(greeting, msgId, newLang);
    }
  };

  const handleSend = async (
    e?: React.FormEvent,
    customPrompt?: string,
    forceSpeakReply?: boolean
  ) => {
    if (e) e.preventDefault();
    const fallbackSpoken = (input || liveInterimText || companionInput).trim();
    const promptToSend = (
      customPrompt !== undefined ? customPrompt : fallbackSpoken
    ).trim();

    if (!promptToSend) {
      // If user clicked Send while mic is recording audio without interim text yet, stop & transcribe blob
      if (isListening && micSessionRef.current) {
        micSessionRef.current.stopAndSubmit();
        micSessionRef.current = null;
      }
      return;
    }

    // If mic was open while submitting, close it cleanly
    if (isListening || micSessionRef.current) {
      stopActiveMicSession();
      micSessionRef.current = null;
      setIsListening(false);
      setAudioLevel(0);
      setRecordingSeconds(0);
    }

    setMicStatusHint(null);
    setLiveInterimText('');
    setInput('');
    setCompanionInput('');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await api.queryAssistant(
        userMsg.text,
        selectedCoords[0],
        selectedCoords[1],
        voiceLangRef.current
      );
      if (data.liveContext) {
        setLatestContext(data.liveContext);
      }
      const aiMsgId = `ai-${Date.now() + 1}`;
      const aiMsg: Message = {
        id: aiMsgId,
        sender: 'ai',
        text: data.response,
        timestamp: data.timestamp || new Date().toISOString(),
        liveContext: data.liveContext
      };
      setMessages(prev => [...prev, aiMsg]);

      if (forceSpeakReply || voiceModeActiveRef.current || autoSpeakReplies) {
        speakText(data.response, aiMsgId);
      }
    } catch {
      const cfg = getVoiceLanguageConfig(voiceLangRef.current);
      const errText = cfg.welcomeGreeting(currentDistrict.name);
      const errMsg: Message = {
        id: `err-${Date.now() + 1}`,
        sender: 'ai',
        text: errText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  handleSendRef.current = (customPrompt?: string) => {
    handleSend(undefined, customPrompt, true);
  };

  const beginMicCapture = () => {
    setMicStatusHint(null);
    setLiveInterimText('');
    setAudioLevel(28);
    setRecordingSeconds(0);
    stopAllVoicePlayback();
    setIsSpeaking(false);
    setSpeakingMsgId(null);

    const session = startMultilingualMicSession(voiceLangRef.current, {
      onListeningChange: listening => {
        setIsListening(listening);
        if (!listening) {
          setAudioLevel(0);
          setRecordingSeconds(0);
        }
      },
      onTranscribingChange: transcribing => {
        setIsTranscribing(transcribing);
      },
      onAudioLevelChange: level => {
        setAudioLevel(level);
      },
      onElapsedSecondsChange: secs => {
        setRecordingSeconds(secs);
      },
      onInterimTranscript: interim => {
        setMicFallbackOpen(false);
        setMicStatusHint(null);
        setLiveInterimText(interim);
        setInput(interim);
        setCompanionInput(interim);
      },
      onFinalTranscript: finalTranscript => {
        setMicFallbackOpen(false);
        setMicStatusHint(null);
        setLiveInterimText('');
        setInput('');
        setCompanionInput('');
        setAudioLevel(0);
        setRecordingSeconds(0);
        if (finalTranscript && finalTranscript.trim()) {
          handleSendRef.current(finalTranscript.trim());
        }
      },
      onPermissionBlocked: () => {
        // Keep the chatbot mic open! Never shut off isListening when browser/iframe restricts hardware mic;
        // also surface the quick Touch-to-Speak voice pills so the user can speak or tap seamlessly.
        setMicFallbackOpen(true);
      },
      onError: msg => {
        setAudioLevel(0);
        setRecordingSeconds(0);
        setIsListening(false);
        setIsTranscribing(false);
        setMicStatusHint(msg);
      }
    });

    micSessionRef.current = session;
  };

  const cancelMicCapture = () => {
    stopActiveMicSession();
    micSessionRef.current = null;
    setIsListening(false);
    setIsTranscribing(false);
    setAudioLevel(0);
    setRecordingSeconds(0);
    setLiveInterimText('');
  };

  const toggleListening = () => {
    if (isListening) {
      const currentSpokenOrTyped = (input || liveInterimText || companionInput).trim();
      if (micSessionRef.current) {
        micSessionRef.current.stopAndSubmit(currentSpokenOrTyped || undefined);
        micSessionRef.current = null;
      } else {
        stopActiveMicSession();
        setIsListening(false);
        setRecordingSeconds(0);
        if (currentSpokenOrTyped) {
          handleSend(undefined, currentSpokenOrTyped, true);
        }
      }
      return;
    }
    beginMicCapture();
  };

  const startVoiceCompanion = () => {
    setVoiceModeActive(true);
    voiceModeActiveRef.current = true;
    beginMicCapture();
  };

  const stopVoiceCompanion = () => {
    setVoiceModeActive(false);
    voiceModeActiveRef.current = false;
    setIsListening(false);
    setIsTranscribing(false);
    setRecordingSeconds(0);
    setLiveInterimText('');
    setIsSpeaking(false);
    setSpeakingMsgId(null);
    stopAllVoicePlayback();
    stopActiveMicSession();
    micSessionRef.current = null;
  };

  const quickPrompts = [
    {
      icon: Car,
      label: langConfig.quickPrompts.trafficLabel,
      text: langConfig.quickPrompts.trafficPrompt
    },
    {
      icon: ShieldAlert,
      label: langConfig.quickPrompts.policeLabel,
      text: langConfig.quickPrompts.policePrompt
    },
    {
      icon: Building2,
      label: langConfig.quickPrompts.hospitalLabel,
      text: langConfig.quickPrompts.hospitalPrompt
    },
    {
      icon: Navigation,
      label: langConfig.quickPrompts.safetyLabel,
      text: langConfig.quickPrompts.safetyPrompt
    },
    {
      icon: Phone,
      label: langConfig.quickPrompts.helpLabel,
      text: langConfig.quickPrompts.helpPrompt
    },
    {
      icon: BatteryCharging,
      label: 'Battery & Offline Mode',
      text: 'Check Battery and Connectivity Guardian and Offline Emergency Mode status.'
    }
  ];

  const latestAiMessage =
    [...messages].reverse().find(m => m.sender === 'ai') || messages[0];

  const getTrafficWidthClass = (pct: number) => {
    if (pct >= 85) return 'w-11/12';
    if (pct >= 70) return 'w-4/5';
    if (pct >= 55) return 'w-3/5';
    if (pct >= 40) return 'w-2/5';
    return 'w-1/4';
  };

  const renderFormattedMessage = (text: string) => {
    const cleaned = text.replace(/\*\*/g, '').replace(/`/g, '');
    const lines = cleaned.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;
          if (trimmed.startsWith('•') || trimmed.startsWith('- ')) {
            const content = trimmed.replace(/^[•-]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-[#E11D48] font-bold">•</span>
                <span>{content}</span>
              </div>
            );
          }
          return <p key={idx}>{trimmed}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent text-[#FAFAFA] p-3 sm:p-5 relative">
      {voiceModeActive && (
        <div className="fixed inset-0 z-50 bg-[#09090B]/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto">
          <div className="text-center space-y-2.5 max-w-xl w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18181B] border border-white/15 text-xs text-[#FFD43B] font-bold">
              <Languages className="w-3.5 h-3.5" />
              <span>
                {langConfig.nativeLabel} ({langConfig.englishLabel}) Voice Companion
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Multilingual Voice Companion
            </h2>
            <p className="text-xs text-[#FFD43B] font-medium">
              {isTranscribing
                ? 'Transcribing your spoken voice...'
                : isSpeaking
                ? langConfig.speakingText
                : isListening
                ? `${langConfig.listeningText} — Speak now or tap any voice button below`
                : 'Tap Mic to speak, or tap any instant voice topic below to hear the AI reply'}
            </p>

            {/* 6-Language Selector inside Full-Screen Voice Companion */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
              {SUPPORTED_VOICE_LANGUAGES.map(l => {
                const active = l.code === voiceLang;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLanguageChange(l.code)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold cursor-pointer border transition-all ${
                      active
                        ? 'bg-[#E11D48] border-white text-white shadow-lg'
                        : 'bg-[#18181B] border-[#303036] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    <div>{l.nativeLabel}</div>
                    <div className="text-[10px] opacity-80">{l.englishLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Mic + Live Spoken Response Card + Instant Tap-to-Speak Topics */}
          <div className="w-full max-w-xl space-y-3 my-3">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer border-2 ${
                  isListening
                    ? 'bg-[#EF4444] border-white scale-105 text-white animate-pulse'
                    : isTranscribing
                    ? 'bg-[#F59E0B] border-white text-white animate-pulse'
                    : isSpeaking
                    ? 'bg-[#E11D48] border-white text-white'
                    : 'bg-[#18181B] border-[#FFD43B] text-[#FFD43B] hover:bg-[#E11D48] hover:text-white hover:border-white'
                }`}
              >
                {isSpeaking ? (
                  <Volume2 className="w-10 h-10 animate-bounce" />
                ) : (
                  <Mic className="w-10 h-10" />
                )}
              </button>

              {isListening && (
                <div className="flex flex-wrap items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-[#18181B] border border-[#22C55E]/50">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping" />
                  <span className="text-xs font-mono font-bold text-[#FFD43B]">
                    REC {formatRecordingTime(recordingSeconds)}
                  </span>
                  <div className="flex items-center justify-center gap-1 h-4 px-1">
                    {[12, 24, 38, 52, 30, 64, 42, 22, 48, 18].map((threshold, idx) => {
                      const isActive = audioLevel >= threshold;
                      return (
                        <span
                          key={idx}
                          className={`w-1 rounded-full transition-all duration-75 ${
                            isActive
                              ? 'h-4 bg-[#22C55E]'
                              : audioLevel > 8
                              ? 'h-2.5 bg-[#22C55E]/70'
                              : 'h-1.5 bg-[#22C55E]/40'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className="px-2.5 py-1 rounded-lg bg-[#22C55E] text-[#09090B] font-bold text-[11px] cursor-pointer"
                  >
                    Send Voice
                  </button>
                  <button
                    type="button"
                    onClick={cancelMicCapture}
                    className="px-2 py-1 rounded-lg bg-[#27272A] text-[#A1A1AA] hover:text-white text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {liveInterimText && (
                <div className="px-3 py-1.5 rounded-xl bg-[#18181B] border border-[#22C55E]/50 text-xs text-white font-medium">
                  Heard: “{liveInterimText}”
                </div>
              )}
            </div>

            {/* Instant Tap-to-Speak Voice Topics (Works even without Hardware Mic!) */}
            <div className="p-3.5 rounded-2xl bg-[#111114] border border-white/15 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#FFD43B] flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>
                    Tap Any Topic to Ask & Hear Voice Reply ({langConfig.nativeLabel})
                  </span>
                </span>
                {micFallbackOpen && (
                  <button
                    type="button"
                    onClick={beginMicCapture}
                    className="px-2 py-0.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-white/15 text-[10px] font-bold text-[#22C55E] cursor-pointer"
                  >
                    Retry Hardware Mic
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickPrompts.map((qp, idx) => {
                  const Icon = qp.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(undefined, qp.text, true)}
                      disabled={loading}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-[#18181B] hover:bg-[#E11D48] border border-[#303036] hover:border-white text-left text-xs font-bold text-white transition-all cursor-pointer group"
                    >
                      <Icon className="w-4 h-4 text-[#FFD43B] group-hover:text-white shrink-0" />
                      <span className="truncate">{qp.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Direct Voice Companion Input Box so User is Never Blocked */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (companionInput.trim()) {
                    handleSend(undefined, companionInput.trim(), true);
                  }
                }}
                className="flex gap-2 pt-1"
              >
                <input
                  type="text"
                  value={companionInput}
                  onChange={e => setCompanionInput(e.target.value)}
                  placeholder={langConfig.inputPlaceholder}
                  className="flex-1 bg-[#18181B] border border-[#303036] rounded-xl px-3 py-2 text-xs text-white placeholder-[#A1A1AA]/70 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !companionInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#FF334F] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Ask & Speak</span>
                </button>
              </form>
            </div>

            {/* Latest AI Voice Reply Preview inside Voice Companion */}
            {latestAiMessage && (
              <div className="p-3.5 rounded-2xl bg-[#111114] border border-[#303036] space-y-2 max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase text-[#22C55E] font-bold">
                    {loading ? 'Fetching Live Response...' : 'Assistant Voice Response'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopAllVoicePlayback();
                        setIsSpeaking(false);
                        setSpeakingMsgId(null);
                      } else {
                        speakText(latestAiMessage.text, latestAiMessage.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#18181B] border border-white/15 text-[11px] font-bold text-[#FFD43B] cursor-pointer"
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-[#EF4444]" />
                        <span>{langConfig.stopButtonLabel}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#FFD43B]" />
                        <span>{langConfig.listenButtonLabel}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-xs text-white/90 leading-relaxed">
                  {renderFormattedMessage(latestAiMessage.text)}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={stopVoiceCompanion}
            className="w-full max-w-xs py-3 rounded-2xl bg-[#EF4444] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Close Voice Companion ({langConfig.stopButtonLabel})</span>
          </button>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chat Interface */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-6.5rem)] luxury-card overflow-hidden">
          <div className="p-4 bg-white/[0.03] border-b border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-[#FF334F]" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Multilingual Voice Assistant</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E11D48]/20 text-[#FFD43B] border border-[#E11D48]/40 font-mono">
                      {langConfig.nativeLabel}
                    </span>
                  </h1>
                  <p className="text-[11px] text-[#A1A1AA]">
                    {currentDistrict.name} • 6 Languages Supported
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
                <div className="flex-1 hidden sm:block">
                  <LocationAutocompleteInput
                    value={placeQuery}
                    onChange={setPlaceQuery}
                    placeholder="Change location..."
                    onSelect={place => setSelectedCoords([place.lat, place.lng])}
                  />
                </div>

                {/* Auto-Read Voice Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (autoSpeakReplies) {
                      stopAllVoicePlayback();
                      setIsSpeaking(false);
                    }
                    setAutoSpeakReplies(prev => !prev);
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center gap-1 ${
                    autoSpeakReplies
                      ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]'
                      : 'bg-[#111114] border-[#303036] text-[#A1A1AA]'
                  }`}
                  title="Auto-speak replies"
                >
                  {autoSpeakReplies ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={startVoiceCompanion}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#E11D48] hover:bg-[#FF334F] text-white rounded-xl text-xs font-bold cursor-pointer shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{langConfig.nativeLabel} Voice</span>
                </button>
              </div>
            </div>

            {/* 6-Language Switcher Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[10px] font-mono uppercase text-[#A1A1AA] flex items-center gap-1 pr-1 shrink-0">
                <Languages className="w-3.5 h-3.5 text-[#FFD43B]" /> Voice Language:
              </span>
              {SUPPORTED_VOICE_LANGUAGES.map(l => {
                const active = l.code === voiceLang;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLanguageChange(l.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                      active
                        ? 'bg-[#E11D48] border-white text-white shadow'
                        : 'bg-[#111114] border-[#303036] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {l.nativeLabel} ({l.englishLabel})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    m.sender === 'user'
                      ? 'bg-[#E11D48] text-white border-[#FF334F]'
                      : 'bg-[#18181B] text-[#E11D48] border-[#303036]'
                  }`}
                >
                  {m.sender === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-2.5 ${
                    m.sender === 'user'
                      ? 'bg-[#E11D48] text-white font-medium rounded-tr-none'
                      : 'bg-[#111114] text-white border border-[#303036] rounded-tl-none'
                  }`}
                >
                  {m.sender === 'user' ? (
                    <div className="text-xs sm:text-sm">{m.text}</div>
                  ) : (
                    renderFormattedMessage(m.text)
                  )}

                  {m.sender === 'ai' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isSpeaking && speakingMsgId === m.id) {
                            stopAllVoicePlayback();
                            setIsSpeaking(false);
                            setSpeakingMsgId(null);
                          } else {
                            speakText(m.text, m.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-white/10 text-[11px] font-bold text-[#FFD43B] cursor-pointer"
                      >
                        {isSpeaking && speakingMsgId === m.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-[#EF4444]" />
                            <span>{langConfig.stopButtonLabel}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-[#FFD43B]" />
                            <span>{langConfig.listenButtonLabel}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {m.sender === 'ai' && m.liveContext && m.liveContext.inTamilNadu && (
                    <div className="pt-2 border-t border-[#303036] space-y-2 text-xs">
                      {m.liveContext.traffic && (
                        <div className="p-2.5 rounded-lg bg-[#18181B] border border-[#303036] flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Car className="w-4 h-4 text-[#FFD43B] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[10px] text-[#A1A1AA] truncate">
                                {m.liveContext.traffic.primaryCorridor}
                              </div>
                              <div className="font-bold text-white text-xs">
                                Traffic: {m.liveContext.traffic.congestionLevel} (
                                {m.liveContext.traffic.congestionPercentage}%) •{' '}
                                {m.liveContext.traffic.averageSpeedKmh} km/h
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              m.liveContext.traffic.congestionLevel === 'HIGH' ||
                              m.liveContext.traffic.congestionLevel === 'SEVERE'
                                ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                                : m.liveContext.traffic.congestionLevel === 'MODERATE'
                                ? 'bg-[#F59E0B]/20 text-[#FFD43B] border border-[#F59E0B]/40'
                                : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                            }`}
                          >
                            +{m.liveContext.traffic.delayMinutesPer10Km}m / 10km
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {m.liveContext.nearestPolice && (
                          <div className="p-2 rounded-lg bg-[#18181B] border border-[#303036] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-[#FF334F]">Police</div>
                              <div className="font-semibold text-white truncate">
                                {m.liveContext.nearestPolice.name}
                              </div>
                            </div>
                            <a
                              href={`tel:${m.liveContext.nearestPolice.phone.split('/')[0].trim()}`}
                              className="px-2 py-1 rounded bg-[#E11D48] text-white font-bold text-[11px] shrink-0"
                            >
                              Call
                            </a>
                          </div>
                        )}
                        {m.liveContext.nearestHospital && (
                          <div className="p-2 rounded-lg bg-[#18181B] border border-[#303036] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] text-[#22C55E]">Hospital</div>
                              <div className="font-semibold text-white truncate">
                                {m.liveContext.nearestHospital.name}
                              </div>
                            </div>
                            <a
                              href={`tel:${m.liveContext.nearestHospital.phone.split('/')[0].trim()}`}
                              className="px-2 py-1 rounded bg-[#22C55E] text-[#09090B] font-bold text-[11px] shrink-0"
                            >
                              Call
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-xs text-[#A1A1AA] flex items-center gap-2 pl-2">
                <Sparkles className="w-3.5 h-3.5 text-[#E11D48] animate-spin" />
                <span>Checking live nearby safety data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3.5 bg-[#111114] border-t border-[#303036] space-y-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {quickPrompts.map((qp, i) => {
                const Icon = qp.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(undefined, qp.text, true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#303036] text-xs text-white whitespace-nowrap cursor-pointer shrink-0"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#E11D48]" />
                    <span>{qp.label}</span>
                  </button>
                );
              })}
            </div>

            {(isListening || isTranscribing) && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-[#22C55E]/60 text-xs shadow-lg">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping shrink-0" />
                  <span className="px-2 py-0.5 rounded-md bg-[#EF4444]/20 border border-[#EF4444]/40 font-mono font-bold text-[#FFD43B] text-[11px] shrink-0">
                    {isTranscribing ? 'TRANSCRIBING' : `REC ${formatRecordingTime(recordingSeconds)}`}
                  </span>
                  {isListening && (
                    <div className="flex items-center gap-1 h-4 px-1 shrink-0">
                      {[12, 24, 38, 52, 30, 64, 42, 22, 48, 18].map((threshold, idx) => {
                        const isActive = audioLevel >= threshold;
                        return (
                          <span
                            key={idx}
                            className={`w-1 rounded-full transition-all duration-75 ${
                              isActive
                                ? 'h-4 bg-[#22C55E]'
                                : audioLevel > 8
                                ? 'h-2.5 bg-[#22C55E]/70'
                                : 'h-1.5 bg-[#22C55E]/40'
                            }`}
                          />
                        );
                      })}
                    </div>
                  )}
                  <span className="font-bold text-[#22C55E] shrink-0 hidden sm:inline">
                    {isTranscribing
                      ? 'Transcribing your spoken query...'
                      : `${langConfig.listeningText}:`}
                  </span>
                  {liveInterimText || input ? (
                    <span className="text-white font-semibold truncate">
                      “{liveInterimText || input}”
                    </span>
                  ) : (
                    <span className="text-[#A1A1AA] truncate">
                      Mic is ON — speak your question continuously...
                    </span>
                  )}
                </div>
                {isListening && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={toggleListening}
                      className="px-3 py-1.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#09090B] font-bold text-[11px] cursor-pointer transition-all"
                    >
                      {liveInterimText || input ? 'Send Spoken Query' : 'Done & Send'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelMicCapture}
                      className="px-2.5 py-1.5 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white font-bold text-[11px] cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {micStatusHint && !isListening && !isTranscribing && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#18181B] border border-[#FFD43B]/40 text-xs text-[#FFD43B]">
                <span>{micStatusHint}</span>
                <button
                  type="button"
                  onClick={beginMicCapture}
                  className="px-2.5 py-1 rounded-lg bg-[#E11D48] text-white font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  Speak Again
                </button>
              </div>
            )}

            {/* User-Friendly Interactive Voice Panel when Browser/Device Restricts Hardware Mic */}
            {micFallbackOpen && !isTranscribing && (
              <div className="p-3 rounded-xl bg-[#18181B] border border-[#FFD43B]/40 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#FFD43B] shrink-0" />
                    <span className="text-xs font-bold text-white">
                      Instant Voice Questions ({langConfig.nativeLabel}) — Speak or Tap Any Question:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMicFallbackOpen(false)}
                    className="px-2 py-0.5 rounded-lg bg-[#27272A] text-[#A1A1AA] hover:text-white text-[11px] cursor-pointer"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {quickPrompts.map((qp, idx) => {
                    const Icon = qp.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setMicFallbackOpen(false);
                          handleSend(undefined, qp.text, true);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#111114] hover:bg-[#E11D48] border border-[#303036] hover:border-white text-xs font-bold text-white text-left transition-all cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                        <span className="truncate">{qp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={e => handleSend(e, undefined, true)} className="flex gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer transition-all font-bold text-xs shrink-0 ${
                  isListening
                    ? 'bg-[#EF4444] border-white text-white shadow-lg'
                    : isTranscribing
                    ? 'bg-[#F59E0B] border-white text-white animate-pulse'
                    : 'bg-[#18181B] border-[#FFD43B]/60 text-[#FFD43B] hover:bg-[#E11D48] hover:text-white hover:border-white'
                }`}
                title={isListening ? 'Tap to Stop & Send Spoken Query' : langConfig.tapToSpeakText}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      Send ({formatRecordingTime(recordingSeconds)})
                    </span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span className="hidden sm:inline">Mic</span>
                  </>
                )}
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? 'Listening to your voice... (words appear here as you speak)'
                    : langConfig.inputPlaceholder
                }
                className={`flex-1 bg-[#18181B] border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#A1A1AA]/60 focus:outline-none transition-all ${
                  isListening ? 'border-[#22C55E] ring-1 ring-[#22C55E]/40' : 'border-[#303036]'
                }`}
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && !liveInterimText.trim() && !isListening)}
                className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#FF334F] disabled:opacity-40 text-white font-bold rounded-xl cursor-pointer"
                title={isListening ? 'Send Spoken Query' : 'Send'}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Battery & Connectivity Guardian + Live Context Summary */}
        <div className="lg:col-span-4 space-y-4 max-h-[calc(100vh-6.5rem)] overflow-y-auto pr-0.5">
          <BatteryConnectivityGuardian
            coords={selectedCoords}
            liveContext={latestContext}
            voiceLang={voiceLang}
          />

          <div className="luxury-card p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#303036] pb-2.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> Live Local Info
              </h2>
              <select
                value={currentDistrict.id}
                onChange={e => {
                  const d = TAMIL_NADU_DISTRICTS.find(item => item.id === e.target.value);
                  if (d) setSelectedCoords([d.lat, d.lng]);
                }}
                className="bg-[#111114] border border-[#303036] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                {TAMIL_NADU_DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-xl bg-[#111114] border border-[#303036] space-y-1">
              <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#E11D48]" /> Location
              </div>
              <div className="text-xs font-semibold text-white line-clamp-2">
                {latestContext?.address || `${currentDistrict.name}, Tamil Nadu`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-[#111114] border border-[#303036]">
                <div className="text-[10px] text-[#A1A1AA]">Safety Score</div>
                <div className="text-xl font-bold font-mono text-[#22C55E] mt-0.5">
                  {latestContext?.safetyScore ?? 88}%
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#111114] border border-[#303036]">
                <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1">
                  <CloudRain className="w-3 h-3 text-[#168BFF]" /> Weather
                </div>
                <div className="text-xs font-semibold text-white mt-1 truncate">
                  {latestContext?.weatherSummary || 'Clear'}
                </div>
              </div>
            </div>

            {/* Live Traffic Congestion & Road Flow Card */}
            {latestContext?.traffic && (
              <div className="p-3.5 rounded-xl bg-[#111114] border border-[#303036] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase text-[#FFD43B] flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-[#FFD43B]" /> Live Traffic Congestion
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      latestContext.traffic.congestionLevel === 'HIGH' ||
                      latestContext.traffic.congestionLevel === 'SEVERE'
                        ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                        : latestContext.traffic.congestionLevel === 'MODERATE'
                        ? 'bg-[#F59E0B]/20 text-[#FFD43B] border border-[#F59E0B]/40'
                        : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                    }`}
                  >
                    {latestContext.traffic.congestionLevel} ({latestContext.traffic.congestionPercentage}%)
                  </span>
                </div>

                <div className="text-xs font-bold text-white leading-snug">
                  {latestContext.traffic.primaryCorridor}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-[#18181B] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getTrafficWidthClass(
                      latestContext.traffic.congestionPercentage
                    )} ${
                      latestContext.traffic.congestionPercentage >= 60
                        ? 'bg-[#EF4444]'
                        : latestContext.traffic.congestionPercentage >= 35
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#22C55E]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-[#18181B] border border-[#303036]">
                    <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-[#22C55E]" /> Avg Speed
                    </div>
                    <div className="font-bold font-mono text-white mt-0.5">
                      {latestContext.traffic.averageSpeedKmh} km/h{' '}
                      <span className="text-[10px] text-[#A1A1AA] font-normal">
                        / {latestContext.traffic.freeFlowSpeedKmh}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#18181B] border border-[#303036]">
                    <div className="text-[10px] text-[#A1A1AA]">Est. Delay</div>
                    <div className="font-bold font-mono text-[#FFD43B] mt-0.5">
                      +{latestContext.traffic.delayMinutesPer10Km} min / 10km
                    </div>
                  </div>
                </div>

                {/* Junction Hotspots */}
                <div className="space-y-1 pt-0.5">
                  <div className="text-[10px] text-[#A1A1AA] font-mono uppercase">
                    Nearby Junction Status
                  </div>
                  {latestContext.traffic.hotspots.map((hs, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-[#18181B]/80"
                    >
                      <span className="text-white truncate pr-2">{hs.name}</span>
                      <span
                        className={`font-mono font-bold shrink-0 ${
                          hs.status === 'CONGESTED'
                            ? 'text-[#EF4444]'
                            : hs.status === 'SLOW'
                            ? 'text-[#FFD43B]'
                            : 'text-[#22C55E]'
                        }`}
                      >
                        {hs.status} • {hs.speedKmh} km/h
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-[#A1A1AA] leading-relaxed">
                  {latestContext.traffic.bypassAdvice}
                </div>

                <button
                  type="button"
                  onClick={() => handleSend(undefined, langConfig.quickPrompts.trafficPrompt, true)}
                  className="w-full py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#FFD43B]/40 text-[#FFD43B] font-bold text-xs cursor-pointer transition-all"
                >
                  🔊 Speak Live Traffic Report ({langConfig.nativeLabel})
                </button>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[#111114] border border-[#303036] space-y-2">
              <div className="text-[10px] font-mono uppercase text-[#FF334F]">Nearest Police</div>
              <div className="text-xs font-bold text-white">
                {latestContext?.nearestPolice?.name || currentDistrict.policeCommissionerate}
              </div>
              <div className="flex gap-2 pt-1">
                <a
                  href={`tel:${
                    latestContext?.nearestPolice?.phone.split('/')[0].trim() ||
                    currentDistrict.policeControlPhone.split('/')[0].trim()
                  }`}
                  className="flex-1 py-1.5 rounded-lg bg-[#E11D48] text-white font-bold text-xs text-center"
                >
                  Call Police
                </a>
                <a
                  href="tel:112"
                  className="px-3 py-1.5 rounded-lg bg-[#EF4444] text-white font-bold text-xs"
                >
                  112
                </a>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111114] border border-[#303036] space-y-2">
              <div className="text-[10px] font-mono uppercase text-[#22C55E]">Nearest Hospital</div>
              <div className="text-xs font-bold text-white">
                {latestContext?.nearestHospital?.name || '24/7 Government Medical'}
              </div>
              <div className="flex gap-2 pt-1">
                <a
                  href={`tel:${
                    latestContext?.nearestHospital?.phone.split('/')[0].trim() || '108'
                  }`}
                  className="flex-1 py-1.5 rounded-lg bg-[#22C55E] text-[#09090B] font-bold text-xs text-center"
                >
                  Call Hospital
                </a>
                <a
                  href="tel:108"
                  className="px-3 py-1.5 rounded-lg bg-[#18181B] border border-[#22C55E]/40 text-[#22C55E] font-bold text-xs"
                >
                  108
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

