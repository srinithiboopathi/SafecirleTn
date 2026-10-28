import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  X,
  Languages,
  Send,
  Sparkles,
  Phone,
  ShieldAlert,
  Building2,
  Navigation,
  Car
} from 'lucide-react';
import { api } from '../services/api';
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
import { resolveTamilNaduDistrict } from '../utils/tamilNaduGeo';

interface MultilingualVoiceAssistantProps {
  userLocation: [number, number];
}

export const MultilingualVoiceAssistant: React.FC<MultilingualVoiceAssistantProps> = ({
  userLocation
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<SupportedVoiceLang>('ta');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [lastQuestion, setLastQuestion] = useState<string>('');
  const [lastAnswer, setLastAnswer] = useState<string>('');

  const micSessionRef = useRef<ActiveMicSession | null>(null);
  const langRef = useRef<SupportedVoiceLang>(lang);
  langRef.current = lang;
  const handleAskRef = useRef<(promptText: string) => void>(() => {});

  const district = resolveTamilNaduDistrict(userLocation[0], userLocation[1]);
  const langConfig = getVoiceLanguageConfig(lang);

  useEffect(() => {
    return () => {
      stopAllVoicePlayback();
      stopActiveMicSession();
    };
  }, []);

  const speakResponse = (text: string, targetLang: SupportedVoiceLang = langRef.current) => {
    speakInVoice(text, targetLang, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false)
    });
  };

  const handleAsk = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    setLastQuestion(trimmed);
    setInputText('');
    setLoading(true);
    stopAllVoicePlayback();

    try {
      const data = await api.queryAssistant(
        trimmed,
        userLocation[0],
        userLocation[1],
        langRef.current
      );
      const reply = data.response || data.answer || '';
      setLastAnswer(reply);
      speakResponse(reply, langRef.current);
    } catch {
      const fallback = langConfig.welcomeGreeting(district.name);
      setLastAnswer(fallback);
      speakResponse(fallback, langRef.current);
    } finally {
      setLoading(false);
    }
  };

  handleAskRef.current = handleAsk;

  const toggleMic = () => {
    if (isListening) {
      if (micSessionRef.current) {
        micSessionRef.current.stopAndSubmit();
        micSessionRef.current = null;
      } else {
        stopActiveMicSession();
        setIsListening(false);
      }
      return;
    }

    stopAllVoicePlayback();
    setIsSpeaking(false);

    const session = startMultilingualMicSession(langRef.current, {
      onListeningChange: listening => setIsListening(listening),
      onTranscribingChange: transcribing => setIsTranscribing(transcribing),
      onInterimTranscript: interim => setInputText(interim),
      onFinalTranscript: transcript => {
        setInputText('');
        if (transcript && transcript.trim()) {
          handleAskRef.current(transcript.trim());
        }
      }
    });

    micSessionRef.current = session;
  };

  const handleSelectLanguage = (newLang: SupportedVoiceLang) => {
    stopActiveMicSession();
    setIsListening(false);
    setIsTranscribing(false);
    setLang(newLang);
    langRef.current = newLang;
    const cfg = getVoiceLanguageConfig(newLang);
    const greeting = cfg.welcomeGreeting(district.name);
    setLastAnswer(greeting);
    speakResponse(greeting, newLang);
  };

  return (
    <>
      {/* Floating Multilingual Voice Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (!lastAnswer) {
              const greeting = langConfig.welcomeGreeting(district.name);
              setLastAnswer(greeting);
              speakResponse(greeting, lang);
            }
          }}
          className="fixed bottom-5 right-5 z-[900] flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#E11D48] to-[#168BFF] text-white font-bold text-xs shadow-[0_8px_30px_rgba(225,29,72,0.5)] border border-white/25 hover:scale-105 transition-all cursor-pointer"
          title="Open Multilingual Voice Assistant"
        >
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <div className="text-left leading-tight">
            <div className="text-[11px] font-extrabold">Voice Assistant</div>
            <div className="text-[9px] text-[#FFD43B] font-mono">
              தமிழ் • EN • हिंदी • తెలుగు • മലയാളം • ಕನ್ನಡ
            </div>
          </div>
        </button>
      )}

      {/* Floating Multilingual Voice Assistant Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-[950] w-[360px] max-w-[calc(100vw-2rem)] luxury-card border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-[#18181B] to-[#11131A] border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E11D48]/20 border border-[#E11D48]/50 flex items-center justify-center">
                <Languages className="w-4 h-4 text-[#FFD43B]" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Multilingual Voice Assistant</h3>
                <p className="text-[10px] text-[#A1A1AA]">
                  {district.name} • {langConfig.nativeLabel} ({langConfig.englishLabel})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopAllVoicePlayback();
                setIsSpeaking(false);
                setIsListening(false);
                setIsOpen(false);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#A1A1AA] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 6-Language Selector Pills */}
          <div className="p-2.5 bg-[#0D0E12] border-b border-white/10">
            <div className="grid grid-cols-3 gap-1.5">
              {SUPPORTED_VOICE_LANGUAGES.map(l => {
                const active = l.code === lang;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleSelectLanguage(l.code)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                      active
                        ? 'bg-[#E11D48] border-white text-white shadow'
                        : 'bg-[#18181B] border-[#303036] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    <span>{l.nativeLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Central Mic & Live Voice Status */}
          <div className="p-4 flex flex-col items-center text-center space-y-3 bg-[#111114]/90">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMic}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer border-2 shadow-xl ${
                  isListening
                    ? 'bg-[#EF4444] border-white scale-110 text-white animate-pulse'
                    : isSpeaking
                    ? 'bg-[#168BFF] border-white text-white'
                    : 'bg-[#18181B] border-[#E11D48] text-[#E11D48] hover:bg-[#E11D48] hover:text-white'
                }`}
                title={langConfig.tapToSpeakText}
              >
                {isSpeaking ? (
                  <Volume2 className="w-7 h-7 animate-bounce" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={() => {
                    stopAllVoicePlayback();
                    setIsSpeaking(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-[#18181B] border border-[#EF4444]/60 text-xs font-bold text-[#EF4444] flex items-center gap-1 cursor-pointer"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>{langConfig.stopButtonLabel}</span>
                </button>
              )}
            </div>

            <div className="text-[11px] font-medium text-[#FFD43B]">
              {loading
                ? 'Thinking...'
                : isTranscribing
                ? 'Transcribing audio...'
                : isListening
                ? `${langConfig.listeningText} (Tap mic to send)`
                : isSpeaking
                ? langConfig.speakingText
                : langConfig.tapToSpeakText}
            </div>

            {/* Spoken Response Box */}
            {lastAnswer && (
              <div className="w-full text-left p-3 rounded-xl bg-[#18181B] border border-[#303036] max-h-40 overflow-y-auto space-y-1.5">
                {lastQuestion && (
                  <div className="text-[10px] text-[#A1A1AA] font-mono truncate">
                    Q: {lastQuestion}
                  </div>
                )}
                <div className="text-xs text-white leading-relaxed whitespace-pre-line">
                  {lastAnswer}
                </div>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => speakResponse(lastAnswer, lang)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#111114] border border-white/10 text-[10px] font-bold text-[#FFD43B] cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{langConfig.listenButtonLabel}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Voice Prompts in Selected Language */}
            <div className="w-full grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleAsk(langConfig.quickPrompts.trafficPrompt)}
                className="col-span-2 p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#FFD43B]/40 text-[11px] text-[#FFD43B] font-bold flex items-center justify-center gap-1.5 truncate cursor-pointer"
              >
                <Car className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                <span className="truncate">🚦 {langConfig.quickPrompts.trafficLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAsk(langConfig.quickPrompts.policePrompt)}
                className="p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#303036] text-[11px] text-white font-medium flex items-center gap-1.5 truncate cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#E11D48] shrink-0" />
                <span className="truncate">{langConfig.quickPrompts.policeLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAsk(langConfig.quickPrompts.hospitalPrompt)}
                className="p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#303036] text-[11px] text-white font-medium flex items-center gap-1.5 truncate cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                <span className="truncate">{langConfig.quickPrompts.hospitalLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAsk(langConfig.quickPrompts.safetyPrompt)}
                className="p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#303036] text-[11px] text-white font-medium flex items-center gap-1.5 truncate cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-[#168BFF] shrink-0" />
                <span className="truncate">{langConfig.quickPrompts.safetyLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAsk(langConfig.quickPrompts.helpPrompt)}
                className="p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#303036] text-[11px] text-white font-medium flex items-center gap-1.5 truncate cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-[#FFD43B] shrink-0" />
                <span className="truncate">{langConfig.quickPrompts.helpLabel}</span>
              </button>
            </div>
          </div>

          {/* Text Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleAsk(inputText);
            }}
            className="p-2.5 bg-[#0D0E12] border-t border-white/10 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={langConfig.inputPlaceholder}
              className="flex-1 bg-[#18181B] border border-[#303036] rounded-xl px-3 py-2 text-xs text-white placeholder-[#A1A1AA]/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="p-2 rounded-xl bg-[#E11D48] hover:bg-[#FF334F] disabled:opacity-40 text-white cursor-pointer"
            >
              {loading ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
};
