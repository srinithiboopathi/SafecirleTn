import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Shield,
  Sparkles,
  PhoneCall,
  MapPin,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import { TrustedContact } from '../types';
import {
  buildTelUrl,
  getDefaultWhatsAppContactId,
  getLocalSavedContacts,
  initiateImmediatePhoneCall
} from '../utils/whatsappUtils';
import { speakInVoice, stopAllVoicePlayback } from '../utils/tamilVoice';

interface FakeCallProps {
  onEnd: () => void;
  currentCoords?: [number, number] | null;
  startConnected?: boolean;
}

export const FakeCallScreen: React.FC<FakeCallProps> = ({
  onEnd,
  currentCoords,
  startConnected = false
}) => {
  const [callState, setCallState] = useState<'ringing' | 'connected'>(
    startConnected ? 'connected' : 'ringing'
  );
  const [callerPersona, setCallerPersona] = useState<string>('Safety Support AI Guardian');
  const [voiceLang, setVoiceLang] = useState<'ta' | 'en'>('ta');
  const [callSeconds, setCallSeconds] = useState<number>(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [savedContacts, setSavedContacts] = useState<TrustedContact[]>(() => getLocalSavedContacts());

  const [transcript, setTranscript] = useState<
    { role: 'user' | 'assistant'; text: string }[]
  >([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const voiceLangRef = useRef<'ta' | 'en'>(voiceLang);
  voiceLangRef.current = voiceLang;

  const primaryContact =
    savedContacts.find((c) => c.id === getDefaultWhatsAppContactId()) ||
    savedContacts.find((c) => c.receiveSos) ||
    savedContacts[0] ||
    null;

  // Load contacts and reverse-geocode live coordinates
  useEffect(() => {
    api.getContacts().then((list) => {
      if (list && list.length > 0) setSavedContacts(list);
    }).catch(() => {});

    const lat = currentCoords?.[0] ?? 11.0168;
    const lng = currentCoords?.[1] ?? 76.9558;
    api
      .reverseGeocode(lat, lng)
      .then((res) => {
        if (res?.address) {
          setCurrentAddress(res.address.split(',').slice(0, 3).join(', '));
        }
      })
      .catch(() => {});
  }, [currentCoords]);

  // Ringtone playback when in ringing state
  useEffect(() => {
    if (callState !== 'ringing') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const ringtoneUrl = 'https://assets.mixkit.co/active_storage/sfx/1351/1351-preview.mp3';
    const audio = new Audio(ringtoneUrl);
    audio.loop = true;
    audioRef.current = audio;

    audio.play().catch(() => {});

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [callState]);

  // Call duration timer when connected
  useEffect(() => {
    if (callState !== 'connected') return;
    const interval = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // Clean up speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      stopAllVoicePlayback();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, isThinking]);

  const speakText = (text: string) => {
    if (!isSpeakerOn) return;
    speakInVoice(text, voiceLangRef.current, {
      onStart: () => setIsAiSpeaking(true),
      onEnd: () => setIsAiSpeaking(false)
    });
  };

  // Trigger initial AI greeting as soon as the call connects
  useEffect(() => {
    if (callState === 'connected' && transcript.length === 0) {
      const locLabel = currentAddress || 'உங்கள் தற்போதைய இடம்';
      const initialGreeting =
        voiceLangRef.current === 'ta'
          ? `வணக்கம், நான் உங்கள் நேரடி ஜிபிஎஸ் இருப்பிடத்தை திரையில் பார்த்துக் கொண்டிருக்கிறேன். பிரதான வெளிச்சமான சாலையிலேயே செல்லுங்கள். நான் உங்களுடன் இணைப்பிலேயே இருக்கிறேன். உங்களுக்கு என்ன உதவி வேண்டும் என்று தமிழில் கூறுங்கள்.`
          : `Hey, I've got your live GPS location locked near ${locLabel} on my screen right now. Keep the phone on speaker and stay on the main well-lit road—I am staying on the line with you the whole way.`;
      setTranscript([{ role: 'assistant', text: initialGreeting }]);
      speakText(initialGreeting);
    }
  }, [callState]);

  const handleAnswerCall = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCallState('connected');
  };

  const handleHangUp = () => {
    stopAllVoicePlayback();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    onEnd();
  };

  const handleSendToAi = async (userMessage: string) => {
    const trimmed = userMessage.trim();
    if (!trimmed || isThinking) return;

    const updatedHistory = [...transcript, { role: 'user' as const, text: trimmed }];
    setTranscript(updatedHistory);
    setInputText('');
    setIsThinking(true);

    try {
      const res = await api.queryAssistant(trimmed, {
        userCoords: currentCoords || [11.0168, 76.9558],
        currentAddress,
        lang: voiceLangRef.current,
        mode: 'companion_call',
        callerPersona,
        history: updatedHistory,
        trustedContacts: savedContacts.map((c) => ({
          name: c.name,
          phone: c.phone,
          relationship: c.relationship
        }))
      });

      const reply =
        res.answer ||
        res.response ||
        (voiceLangRef.current === 'ta'
          ? 'நான் உங்கள் நேரடி ஜிபிஎஸ் இருப்பிடத்தை கண்காணித்துக் கொண்டிருக்கிறேன். பிரதான சாலையிலேயே செல்லுங்கள்.'
          : "I'm right here watching your live GPS pin. Keep heading toward the main lit street.");
      setTranscript((prev) => [...prev, { role: 'assistant', text: reply }]);
      speakText(reply);
    } catch {
      const fallbackReply =
        voiceLangRef.current === 'ta'
          ? 'நான் உங்களுடன் இணைப்பில் இருக்கிறேன். அவசர உதவிக்கு 112 அல்லது உங்கள் குடும்பத்தினரை உடனடியாக அழைக்கலாம்.'
          : 'I have your live GPS coordinates locked on my screen. Stay in the well-lit lane and tap the green Real Call button if you want to dial your trusted contact or 112 immediately.';
      setTranscript((prev) => [...prev, { role: 'assistant', text: fallbackReply }]);
      speakText(fallbackReply);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleVoiceMic = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      handleSendToAi(
        voiceLangRef.current === 'ta'
          ? 'நான் இப்போது நடந்து செல்கிறேன், என் நேரடி இருப்பிடத்தை சரிபார்த்து என்னுடன் இணைப்பில் இருங்கள்.'
          : 'I am walking right now, please check my live location and stay on the line with me.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLangRef.current === 'ta' ? 'ta-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        stopAllVoicePlayback();
        setIsAiSpeaking(false);
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const spokenText = event.results?.[0]?.[0]?.transcript;
        setIsListening(false);
        if (spokenText && spokenText.trim()) {
          handleSendToAi(spokenText.trim());
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const formatCallTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const quickVoicePrompts =
    voiceLang === 'ta'
      ? [
          'நான் நடக்கும்போது என்னுடன் இணைப்பில் இருங்கள்',
          'அருகிலுள்ள காவல் நிலையம் எங்கே உள்ளது?',
          'யாரோ என்னை பின்தொடர்வது போல் உள்ளது, என்ன செய்வது?',
          'நான் ஆட்டோவில் செல்கிறேன், என் ஜிபிஎஸ் இருப்பிடத்தை கண்காணிக்கவும்'
        ]
      : [
          'Stay on the line with me while I walk',
          'Someone is following me, what should I do?',
          'Where is the nearest police station from me?',
          'I am in a cab/auto, track my live GPS'
        ];

  return (
    <div className="fixed inset-0 z-[100] bg-[#090a0f] flex flex-col justify-between p-5 sm:p-8 text-white select-none overflow-y-auto">
      {/* Top Caller Info & Persona Switcher */}
      <div className="max-w-md w-full mx-auto text-center space-y-3 pt-2">
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
            <Shield className="w-3.5 h-3.5" />
            <span>
              {callState === 'ringing'
                ? 'Incoming Safety Guardian Call'
                : `Live AI Voice Guardian · ${formatCallTimer(callSeconds)}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = voiceLang === 'ta' ? 'en' : 'ta';
              setVoiceLang(next);
              voiceLangRef.current = next;
              speakText(
                next === 'ta'
                  ? 'தமிழ் குரல் தேர்ந்தெடுக்கப்பட்டது.'
                  : 'English voice selected.'
              );
            }}
            className="px-2.5 py-1 rounded-full bg-[#18181B] border border-white/20 text-[11px] font-bold text-[#FFD43B] cursor-pointer"
          >
            {voiceLang === 'ta' ? '🔊 தமிழ்' : '🔊 ENG'}
          </button>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {callerPersona}
        </h2>

        <p className="text-xs text-[#a1a1aa] flex items-center justify-center space-x-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#0a84ff] shrink-0" />
          <span className="truncate max-w-xs">
            {currentAddress ||
              (currentCoords
                ? `GPS: ${currentCoords[0].toFixed(4)}°N, ${currentCoords[1].toFixed(4)}°E`
                : 'Live GPS Tracking Active')}
          </span>
        </p>

        {/* Caller Persona Selector Pills */}
        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {[
            'Safety Support AI Guardian',
            'Dad (Family Guardian)',
            'Mom (Live GPS Watch)',
            'Police Control Dispatch'
          ].map((persona) => (
            <button
              key={persona}
              type="button"
              onClick={() => setCallerPersona(persona)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition border ${
                callerPersona === persona
                  ? 'bg-[#0a84ff] text-white border-[#0a84ff]'
                  : 'bg-white/5 text-[#a1a1aa] border-white/10 hover:text-white'
              }`}
            >
              {persona}
            </button>
          ))}
        </div>

        {/* Immediate Real Normal Phone Call to Saved Trusted Contact */}
        {primaryContact && (
          <div className="pt-2">
            <a
              href={buildTelUrl(primaryContact.phone)}
              target="_top"
              onClick={() => initiateImmediatePhoneCall(primaryContact.phone)}
              className="w-full py-2.5 px-4 bg-[#30d158] hover:bg-[#28b84c] text-black font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-[#30d158]/25 transition"
            >
              <PhoneCall className="w-4 h-4 fill-black" />
              <span>
                Place Real Normal Call to {primaryContact.name} ({primaryContact.phone})
              </span>
            </a>
          </div>
        )}
      </div>

      {/* Middle Section: Ringing Avatar OR Connected Live AI Conversation */}
      {callState === 'ringing' ? (
        <div className="my-auto flex flex-col items-center space-y-5 py-8">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-[#0a84ff]/20 border-2 border-[#0a84ff] flex items-center justify-center animate-pulse">
              <Sparkles className="w-12 h-12 text-[#64b5ff]" />
            </div>
            <span className="absolute -bottom-1 right-1 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
              AI LIVE
            </span>
          </div>
          <p className="text-sm text-white/80 max-w-xs text-center leading-relaxed">
            Tap the green <strong className="text-emerald-400">Answer</strong> button to speak with the live AI Safety Guardian on speakerphone, or dial your trusted contact directly above.
          </p>
        </div>
      ) : (
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-between my-4 space-y-3 min-h-0">
          {/* Active Voice Waveform Indicator */}
          <div className="bg-[#14161d] border border-white/10 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  isAiSpeaking
                    ? 'bg-emerald-400 animate-ping'
                    : isListening
                    ? 'bg-[#ff453a] animate-ping'
                    : 'bg-[#0a84ff]'
                }`}
              />
              <span className="text-xs font-semibold text-white">
                {isAiSpeaking
                  ? `${callerPersona} is speaking...`
                  : isListening
                  ? 'Listening to your voice...'
                  : isThinking
                  ? 'Analyzing live GPS & responding...'
                  : 'Connected on Speakerphone (Tap Mic or Quick Reply)'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !isSpeakerOn;
                setIsSpeakerOn(next);
                if (!next) {
                  stopAllVoicePlayback();
                  setIsAiSpeaking(false);
                }
              }}
              className={`p-1.5 rounded-xl border text-xs flex items-center space-x-1 ${
                isSpeakerOn
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-[#a1a1aa]'
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-[10px] font-bold">{isSpeakerOn ? 'Speaker ON' : 'Muted'}</span>
            </button>
          </div>

          {/* Live Transcript Box */}
          <div className="bg-[#121318] border border-white/10 rounded-2xl p-3.5 space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar flex-1">
            {transcript.map((item, idx) => (
              <div
                key={idx}
                className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    item.role === 'user'
                      ? 'bg-[#0a84ff] text-white'
                      : 'bg-[#1c1e26] border border-white/10 text-[#f5f5f7]'
                  }`}
                >
                  <span className="block text-[9px] font-bold uppercase tracking-wider opacity-60 mb-0.5">
                    {item.role === 'user' ? 'You' : callerPersona}
                  </span>
                  {item.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="text-xs text-[#a1a1aa] italic px-2">
                {callerPersona} is checking your live route...
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Quick Tap-to-Say Prompts */}
          <div className="flex flex-wrap gap-1.5">
            {quickVoicePrompts.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isThinking}
                onClick={() => handleSendToAi(promptText)}
                className="text-[11px] bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl px-2.5 py-1.5 text-left text-[#f5f5f7] transition"
              >
                "{promptText}"
              </button>
            ))}
          </div>

          {/* Text / Voice Input Row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceMic}
              className={`p-3 rounded-2xl font-bold transition flex items-center justify-center shrink-0 ${
                isListening
                  ? 'bg-[#ff453a] text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
              }`}
              title="Speak to AI Guardian with your microphone"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendToAi(inputText)}
              placeholder="Say or type anything to AI Guardian..."
              className="flex-1 bg-[#17181c] border border-white/15 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-[#a1a1aa]/60 focus:outline-hidden focus:border-[#0a84ff]"
            />

            <button
              type="button"
              disabled={!inputText.trim() || isThinking}
              onClick={() => handleSendToAi(inputText)}
              className="p-3 bg-[#0a84ff] hover:bg-[#0077ed] disabled:opacity-40 text-white rounded-2xl transition shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Call Controls */}
      <div className="max-w-md w-full mx-auto pt-2 pb-2">
        {callState === 'ringing' ? (
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center space-y-1.5">
              <button
                type="button"
                onClick={handleHangUp}
                className="w-16 h-16 rounded-full bg-[#ff453a] hover:bg-[#d93025] flex items-center justify-center text-white shadow-lg shadow-[#ff453a]/30 transition active:scale-95"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs text-[#a1a1aa] font-medium">Decline</span>
            </div>

            <div className="flex flex-col items-center space-y-1.5">
              <button
                type="button"
                onClick={handleAnswerCall}
                className="w-16 h-16 rounded-full bg-[#30d158] hover:bg-[#28b84c] flex items-center justify-center text-black shadow-lg shadow-[#30d158]/40 transition active:scale-95 animate-bounce"
              >
                <Phone className="w-7 h-7 fill-black" />
              </button>
              <span className="text-xs text-emerald-400 font-bold">Answer AI Call</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <a
              href="tel:112"
              target="_top"
              className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold flex items-center space-x-1.5 transition"
            >
              <PhoneCall className="w-4 h-4 text-[#ff453a]" />
              <span>Dial 112 Police</span>
            </a>

            <button
              type="button"
              onClick={handleHangUp}
              className="px-6 py-3 rounded-full bg-[#ff453a] hover:bg-[#d93025] text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-[#ff453a]/30 transition active:scale-95"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End AI Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
