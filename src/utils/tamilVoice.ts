export type SupportedVoiceLang = 'ta' | 'en' | 'hi' | 'te' | 'ml' | 'kn';

export interface VoiceLanguageOption {
  code: SupportedVoiceLang;
  nativeLabel: string;
  englishLabel: string;
  shortBadge: string;
  bcp47: string;
  ttsCode: string;
  welcomeGreeting: (districtName: string) => string;
  listeningText: string;
  speakingText: string;
  tapToSpeakText: string;
  listenButtonLabel: string;
  stopButtonLabel: string;
  inputPlaceholder: string;
  quickPrompts: {
    policeLabel: string;
    policePrompt: string;
    hospitalLabel: string;
    hospitalPrompt: string;
    safetyLabel: string;
    safetyPrompt: string;
    trafficLabel: string;
    trafficPrompt: string;
    helpLabel: string;
    helpPrompt: string;
  };
}

export const SUPPORTED_VOICE_LANGUAGES: VoiceLanguageOption[] = [
  {
    code: 'ta',
    nativeLabel: 'தமிழ்',
    englishLabel: 'Tamil',
    shortBadge: 'தமிழ்',
    bcp47: 'ta-IN',
    ttsCode: 'ta',
    welcomeGreeting: district =>
      `வணக்கம்! நான் உங்கள் ${district} மாவட்ட பாதுகாப்பு மற்றும் போக்குவரத்து குரல் உதவியாளர். அருகிலுள்ள காவல் நிலையம், மருத்துவமனை, போக்குவரத்து நெரிசல் அல்லது பாதுகாப்பு தகவல்களை தமிழில் கேட்கலாம்.`,
    listeningText: 'கேட்கிறது... தமிழில் பேசுங்கள்',
    speakingText: 'தமிழில் பேசுகிறது...',
    tapToSpeakText: 'மைக்கை தொட்டு தமிழில் பேசுங்கள்',
    listenButtonLabel: 'தமிழில் கேள்',
    stopButtonLabel: 'நிறுத்து',
    inputPlaceholder: 'தமிழில் கேளுங்கள் அல்லது மைக்கை அழுத்திப் பேசுங்கள்...',
    quickPrompts: {
      policeLabel: 'காவல் நிலையம்',
      policePrompt: 'அருகிலுள்ள காவல் நிலையம் மற்றும் தொலைபேசி எண் என்ன?',
      hospitalLabel: '24/7 மருத்துவமனை',
      hospitalPrompt: 'எனக்கு அருகிலுள்ள 24 மணி நேர மருத்துவமனை எங்கே உள்ளது?',
      safetyLabel: 'பாதுகாப்பு மதிப்பெண்',
      safetyPrompt: 'இந்த இடத்தின் தற்போதைய பாதுகாப்பு மதிப்பெண் மற்றும் விவரம் என்ன?',
      trafficLabel: 'போக்குவரத்து நெரிசல்',
      trafficPrompt: 'இந்த இடத்தின் நேரடி போக்குவரத்து நெரிசல் மற்றும் சாலை வேகம் என்ன?',
      helpLabel: 'அவசர உதவி',
      helpPrompt: 'நான் தனியாக நடந்து செல்கிறேன், உடனடி பாதுகாப்பு வழிமுறைகளை தமிழில் கூறுங்கள்.'
    }
  },
  {
    code: 'en',
    nativeLabel: 'English',
    englishLabel: 'English',
    shortBadge: 'ENG',
    bcp47: 'en-IN',
    ttsCode: 'en-IN',
    welcomeGreeting: district =>
      `Hello! I am your SafeCircle Voice Assistant for ${district}. Ask me for live traffic congestion, nearest police station, 24/7 hospital, or route safety.`,
    listeningText: 'Listening... Speak in English',
    speakingText: 'Speaking in English...',
    tapToSpeakText: 'Tap mic to speak in English',
    listenButtonLabel: 'Listen',
    stopButtonLabel: 'Stop',
    inputPlaceholder: 'Ask for traffic congestion, police, hospital, or safety...',
    quickPrompts: {
      policeLabel: 'Nearest Police',
      policePrompt: 'Where is the nearest Police Station and phone number?',
      hospitalLabel: '24/7 Hospital',
      hospitalPrompt: 'Show the closest 24/7 hospital near me.',
      safetyLabel: 'Area Safety',
      safetyPrompt: 'What is the current safety score and lighting here?',
      trafficLabel: 'Live Traffic',
      trafficPrompt: 'What is the live traffic congestion, road speed, and delay here?',
      helpLabel: 'Emergency Help',
      helpPrompt: 'I feel unsafe walking alone. Give me immediate emergency steps.'
    }
  },
  {
    code: 'hi',
    nativeLabel: 'हिन्दी',
    englishLabel: 'Hindi',
    shortBadge: 'हिन्दी',
    bcp47: 'hi-IN',
    ttsCode: 'hi',
    welcomeGreeting: district =>
      `नमस्ते! मैं ${district} के लिए आपका SafeCircle सुरक्षा वॉयस असिस्टेंट हूँ। लाइव ट्रैफिक भीड़, नजदीकी पुलिस स्टेशन, अस्पताल या सुरक्षा जानकारी के लिए पूछें।`,
    listeningText: 'सुन रहा हूँ... हिन्दी में बोलें',
    speakingText: 'हिन्दी में बोल रहा है...',
    tapToSpeakText: 'माइक दबाकर हिन्दी में बोलें',
    listenButtonLabel: 'हिन्दी में सुनें',
    stopButtonLabel: 'रोकें',
    inputPlaceholder: 'हिन्दी में पूछें या माइक दबाकर बोलें...',
    quickPrompts: {
      policeLabel: 'नजदीकी पुलिस',
      policePrompt: 'सबसे नजदीकी पुलिस स्टेशन और फोन नंबर क्या है?',
      hospitalLabel: '24/7 अस्पताल',
      hospitalPrompt: 'मेरे पास सबसे नजदीकी 24 घंटे का अस्पताल कहाँ है?',
      safetyLabel: 'सुरक्षा स्कोर',
      safetyPrompt: 'इस क्षेत्र का वर्तमान सुरक्षा स्कोर और मौसम कैसा है?',
      trafficLabel: 'लाइव ट्रैफिक',
      trafficPrompt: 'यहाँ की लाइव ट्रैफिक भीड़ और सड़क की गति कैसी है?',
      helpLabel: 'आपातकालीन मदद',
      helpPrompt: 'मैं अकेले चलते हुए असुरक्षित महसूस कर रही हूँ, तुरंत सुरक्षा उपाय बताएं।'
    }
  },
  {
    code: 'te',
    nativeLabel: 'తెలుగు',
    englishLabel: 'Telugu',
    shortBadge: 'తెలుగు',
    bcp47: 'te-IN',
    ttsCode: 'te',
    welcomeGreeting: district =>
      `నమస్కారం! నేను ${district} కోసం మీ SafeCircle భద్రతా వాయిస్ అసిస్టెంట్‌ని. ప్రత్యక్ష ట్రాఫిక్ రద్దీ, సమీప పోలీస్ స్టేషన్, ఆసుపత్రి లేదా భద్రతా సమాచారం కోసం తెలుగులో అడగండి.`,
    listeningText: 'వింటోంది... తెలుగులో మాట్లాడండి',
    speakingText: 'తెలుగులో మాట్లాడుతోంది...',
    tapToSpeakText: 'మైక్ నొక్కి తెలుగులో మాట్లాడండి',
    listenButtonLabel: 'తెలుగులో వినండి',
    stopButtonLabel: 'ఆపండి',
    inputPlaceholder: 'తెలుగులో అడగండి లేదా మైక్ నొక్కి మాట్లాడండి...',
    quickPrompts: {
      policeLabel: 'సమీప పోలీస్ స్టేషన్',
      policePrompt: 'సమీప పోలీస్ స్టేషన్ మరియు ఫోన్ నంబర్ ఏమిటి?',
      hospitalLabel: '24/7 ఆసుపత్రి',
      hospitalPrompt: 'నాకు సమీపంలోని 24 గంటల ఆసుపత్రి ఎక్కడ ఉంది?',
      safetyLabel: 'భద్రతా స్కోర్',
      safetyPrompt: 'ఈ ప్రాంతం యొక్క ప్రస్తుత భద్రతా స్కోర్ ఎంత?',
      trafficLabel: 'ట్రాఫిక్ రద్దీ',
      trafficPrompt: 'ఈ ప్రాంతంలో ప్రత్యక్ష ట్రాఫిక్ రద్దీ మరియు వేగం ఎలా ఉంది?',
      helpLabel: 'అత్యవసర సహాయం',
      helpPrompt: 'నేను ఒంటరిగా నడుస్తున్నాను, వెంటనే భద్రతా సూచనలు తెలుగులో చెప్పండి.'
    }
  },
  {
    code: 'ml',
    nativeLabel: 'മലയാളം',
    englishLabel: 'Malayalam',
    shortBadge: 'മലയാളം',
    bcp47: 'ml-IN',
    ttsCode: 'ml',
    welcomeGreeting: district =>
      `നമസ്കാരം! ഞാൻ ${district} ജില്ലയിലെ നിങ്ങളുടെ SafeCircle സുരക്ഷാ വോയ്‌സ് അസിസ്റ്റന്റാണ്. തത്സമയ ഗതാഗത തിരക്ക്, അടുത്തുള്ള പോലീസ് സ്റ്റേഷൻ, ആശുപത്രി അല്ലെങ്കിൽ സുരക്ഷാ വിവരങ്ങൾ മലയാളത്തിൽ ചോദിക്കാം.`,
    listeningText: 'ശ്രദ്ധിക്കുന്നു... മലയാളത്തിൽ സംസാരിക്കൂ',
    speakingText: 'മലയാളത്തിൽ സംസാരിക്കുന്നു...',
    tapToSpeakText: 'മൈക്കിൽ തൊട്ട് മലയാളത്തിൽ സംസാരിക്കൂ',
    listenButtonLabel: 'മലയാളത്തിൽ കേൾക്കൂ',
    stopButtonLabel: 'നിർത്തുക',
    inputPlaceholder: 'മലയാളത്തിൽ ചോദിക്കൂ അല്ലെങ്കിൽ മൈക്കിൽ സംസാരിക്കൂ...',
    quickPrompts: {
      policeLabel: 'പോലീസ് സ്റ്റേഷൻ',
      policePrompt: 'അടുത്തുള്ള പോലീസ് സ്റ്റേഷനും ഫോൺ നമ്പറും ഏതാണ്?',
      hospitalLabel: '24/7 ആശുപത്രി',
      hospitalPrompt: 'എനിക്ക് അടുത്തുള്ള 24 മണിക്കൂർ ആശുപത്രി എവിടെയാണ്?',
      safetyLabel: 'സുരക്ഷാ സ്കോർ',
      safetyPrompt: 'ഈ സ്ഥലത്തെ നിലവിലെ സുരക്ഷാ സ്കോർ എത്രയാണ്?',
      trafficLabel: 'ഗതാഗത തിരക്ക്',
      trafficPrompt: 'ഇവിടുത്തെ തത്സമയ ഗതാഗത തിരക്കും റോഡ് വേഗതയും എങ്ങനെയുണ്ട്?',
      helpLabel: 'അടിയന്തര സഹായം',
      helpPrompt: 'ഞാൻ തനിച്ചാണ് നടക്കുന്നത്, അടിയന്തര സുരക്ഷാ നിർദ്ദേശങ്ങൾ മലയാളത്തിൽ പറയൂ.'
    }
  },
  {
    code: 'kn',
    nativeLabel: 'ಕನ್ನಡ',
    englishLabel: 'Kannada',
    shortBadge: 'ಕನ್ನಡ',
    bcp47: 'kn-IN',
    ttsCode: 'kn',
    welcomeGreeting: district =>
      `ನಮಸ್ಕಾರ! ನಾನು ${district} ಗಾಗಿ ನಿಮ್ಮ SafeCircle ಸುರಕ್ಷತಾ ಧ್ವನಿ ಸಹಾಯಕ. ನೇರ ಟ್ರಾಫಿಕ್ ದಟ್ಟಣೆ, ಹತ್ತಿರದ ಪೊಲೀಸ್ ಠಾಣೆ, ಆಸ್ಪತ್ರೆ ಅಥವಾ ಸುರಕ್ಷತಾ ಮಾಹಿತಿಗಾಗಿ ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ.`,
    listeningText: 'ಆಲಿಸುತ್ತಿದೆ... ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ',
    speakingText: 'ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡುತ್ತಿದೆ...',
    tapToSpeakText: 'ಮೈಕ್ ಒತ್ತಿ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ',
    listenButtonLabel: 'ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ',
    stopButtonLabel: 'ನಿಲ್ಲಿಸಿ',
    inputPlaceholder: 'ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ...',
    quickPrompts: {
      policeLabel: 'ಪೊಲೀಸ್ ಠಾಣೆ',
      policePrompt: 'ಹತ್ತಿರದ ಪೊಲೀಸ್ ಠಾಣೆ ಮತ್ತು ಫೋನ್ ಸಂಖ್ಯೆ ಯಾವುದು?',
      hospitalLabel: '24/7 ಆಸ್ಪತ್ರೆ',
      hospitalPrompt: 'ನನ್ನ ಹತ್ತಿರದ 24 ಗಂಟೆಗಳ ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿದೆ?',
      safetyLabel: 'ಸುರಕ್ಷತಾ ಸ್ಕೋರ್',
      safetyPrompt: 'ಈ ಪ್ರದೇಶದ ಪ್ರಸ್ತುತ ಸುರಕ್ಷತಾ ಸ್ಕೋರ್ ಎಷ್ಟು?',
      trafficLabel: 'ನೇರ ಟ್ರಾಫಿಕ್',
      trafficPrompt: 'ಇಲ್ಲಿನ ನೇರ ಟ್ರಾಫಿಕ್ ದಟ್ಟಣೆ ಮತ್ತು ರಸ್ತೆ ವೇಗ ಹೇಗಿದೆ?',
      helpLabel: 'ತುರ್ತು ಸಹಾಯ',
      helpPrompt: 'ನಾನು ಒಬ್ಬಂಟಿಯಾಗಿ ನಡೆಯುತ್ತಿದ್ದೇನೆ, ತಕ್ಷಣದ ಸುರಕ್ಷತಾ ಸೂಚನೆಗಳನ್ನು ಕನ್ನಡದಲ್ಲಿ ತಿಳಿಸಿ.'
    }
  }
];

export function getVoiceLanguageConfig(code: SupportedVoiceLang): VoiceLanguageOption {
  return (
    SUPPORTED_VOICE_LANGUAGES.find(l => l.code === code) || SUPPORTED_VOICE_LANGUAGES[0]
  );
}

let activeAudio: HTMLAudioElement | null = null;
let activeSpeechSessionId = 0;
let activeAbortController: AbortController | null = null;

export function stopAllVoicePlayback() {
  activeSpeechSessionId += 1;

  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {
      // Ignore
    }
    activeAbortController = null;
  }

  if (activeAudio) {
    try {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // Ignore
    }
    activeAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

function cleanTextForSpeech(raw: string, lang: SupportedVoiceLang = 'ta'): string {
  let text = String(raw || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[*#_`~>•|—–]/g, ', ')
    .replace(/\((?:LOW|MODERATE|HIGH|SEVERE|CRITICAL|MOVING|SLOW|CONGESTED)[^)]*\)/gi, ' ');

  if (lang === 'ta') {
    text = text
      .replace(/km\/h/gi, 'கிலோமீட்டர் வேகம்')
      .replace(/(\d+)\s*m\b/g, '$1 மீட்டர்')
      .replace(/(\d+)\s*km\b/gi, '$1 கிலோமீட்டர்')
      .replace(/\bLOW\b/g, 'குறைவு')
      .replace(/\bMODERATE\b/g, 'மிதமானது')
      .replace(/\bHIGH\b/g, 'அதிகம்')
      .replace(/\bSEVERE\b/g, 'மிக அதிகம்');
  } else if (lang === 'en') {
    text = text
      .replace(/km\/h/gi, 'kilometers per hour')
      .replace(/(\d+)\/100/g, '$1 out of 100')
      .replace(/\+(\d+)m\b/g, 'plus $1 minutes');
  }

  return text
    .replace(/\s+/g, ' ')
    .replace(/,\s*,+/g, ', ')
    .trim();
}

function speakWithBrowserSynthesis(
  text: string,
  lang: SupportedVoiceLang,
  sessionId: number,
  callbacks?: { onStart?: () => void; onEnd?: () => void }
) {
  if (sessionId !== activeSpeechSessionId) return;

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const cfg = getVoiceLanguageConfig(lang);
    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text, lang));
    utterance.lang = cfg.bcp47;
    utterance.rate = lang === 'en' ? 1.0 : 0.95;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const langPrefix = lang.toLowerCase();
      const matchedVoice =
        voices.find(v => v.lang.toLowerCase() === cfg.bcp47.toLowerCase()) ||
        voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) ||
        voices.find(v =>
          v.name.toLowerCase().includes(cfg.englishLabel.toLowerCase())
        ) ||
        voices.find(v => v.lang.toLowerCase() === 'en-in');
      if (matchedVoice) utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      if (sessionId === activeSpeechSessionId) callbacks?.onStart?.();
    };
    utterance.onend = () => {
      if (sessionId === activeSpeechSessionId) callbacks?.onEnd?.();
    };
    utterance.onerror = () => {
      if (sessionId === activeSpeechSessionId) callbacks?.onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  } catch {
    if (sessionId === activeSpeechSessionId) callbacks?.onEnd?.();
  }
}

export async function speakInVoice(
  text: string,
  lang: SupportedVoiceLang = 'ta',
  callbacks?: { onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  // Immediately cancel any existing audio, speechSynthesis, or in-flight TTS fetch
  stopAllVoicePlayback();

  const mySessionId = activeSpeechSessionId;
  const cleaned = cleanTextForSpeech(text, lang);
  if (!cleaned) {
    callbacks?.onEnd?.();
    return;
  }

  const abortController = new AbortController();
  activeAbortController = abortController;
  let fallbackTriggered = false;

  const triggerSingleFallback = () => {
    if (fallbackTriggered || mySessionId !== activeSpeechSessionId) return;
    fallbackTriggered = true;
    speakWithBrowserSynthesis(cleaned, lang, mySessionId, callbacks);
  };

  try {
    callbacks?.onStart?.();
    const res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned.slice(0, 520), lang }),
      signal: abortController.signal
    });

    // If another speech request started or stopAllVoicePlayback was called while fetching, abort immediately
    if (mySessionId !== activeSpeechSessionId) {
      return;
    }

    if (res.ok) {
      const data = await res.json();
      if (mySessionId !== activeSpeechSessionId) {
        return;
      }

      if (data && data.audioBase64 && data.mimeType) {
        // Ensure browser speechSynthesis is completely silent before playing HTML5 Audio
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
        activeAudio = audio;

        audio.onended = () => {
          if (activeAudio === audio) activeAudio = null;
          if (mySessionId === activeSpeechSessionId) {
            callbacks?.onEnd?.();
          }
        };

        audio.onerror = () => {
          if (activeAudio === audio) activeAudio = null;
          triggerSingleFallback();
        };

        await audio.play();
        return;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' || mySessionId !== activeSpeechSessionId) {
      return;
    }
  }

  triggerSingleFallback();
}

export function buildTamilRouteAnnouncement(params: {
  routeName: string;
  optionNumber: number;
  safetyScore: number;
  durationSeconds: number;
  distanceMeters: number;
  destination?: string;
  lang?: SupportedVoiceLang;
}): string {
  const mins = Math.max(1, Math.round((params.durationSeconds || 180) / 60));
  const km = params.distanceMeters ? (params.distanceMeters / 1000).toFixed(1) : '1.0';
  const lang = params.lang || 'ta';

  switch (lang) {
    case 'hi':
      return `रूट विकल्प ${params.optionNumber} चुना गया है। सुरक्षा स्कोर 100 में से ${params.safetyScore} है। दूरी ${km} किलोमीटर और यात्रा का समय लगभग ${mins} मिनट है। कृपया मुख्य रोशनी वाली सड़क पर चलें। आपातकालीन सहायता के लिए 112 पर कॉल करें।`;
    case 'te':
      return `మార్గం ఎంపిక ${params.optionNumber} ఎంచుకోబడింది. భద్రతా స్కోరు 100 కి ${params.safetyScore}. దూరం ${km} కిలోమీటర్లు, ప్రయాణ సమయం సుమారు ${mins} నిమిషాలు. అత్యవసర సహాయం కోసం 112 కు కాల్ చేయండి.`;
    case 'ml':
      return `റൂട്ട് ഓപ്ഷൻ ${params.optionNumber} തിരഞ്ഞെടുത്തു. സുരക്ഷാ സ്കോർ 100 ൽ ${params.safetyScore}. ദൂരം ${km} കിലോമീറ്റർ, യാത്രാ സമയം ഏകദേശം ${mins} മിനിറ്റ്. അടിയന്തര സഹായത്തിന് 112 ൽ വിളിക്കുക.`;
    case 'kn':
      return `ಮಾರ್ಗ ಆಯ್ಕೆ ${params.optionNumber} ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ. ಸುರಕ್ಷತಾ ಸ್ಕೋರ್ 100 ಕ್ಕೆ ${params.safetyScore}. ದೂರ ${km} ಕಿಲೋಮೀಟರ್, ಪ್ರಯಾಣದ ಸಮಯ ಸುಮಾರು ${mins} ನಿಮಿಷಗಳು. ತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ 112 ಗೆ ಕರೆ ಮಾಡಿ.`;
    case 'en':
      return `Route Option ${params.optionNumber} selected. Safety score is ${params.safetyScore} percent. Distance is ${km} kilometers and estimated travel time is ${mins} minutes. Stay on well-lit main roads and dial 112 for emergencies.`;
    case 'ta':
    default: {
      const destText = params.destination ? `${params.destination} செல்வதற்கான ` : '';
      return `${destText}வழித்தடம் விருப்பம் ${params.optionNumber} தேர்ந்தெடுக்கப்பட்டது. பாதுகாப்பு மதிப்பெண் நூற்றுக்கு ${params.safetyScore}. தூரம் ${km} கிலோமீட்டர், பயண நேரம் சுமார் ${mins} நிமிடங்கள். பிரதான வெளிச்சமான சாலையில் பாதுகாப்பாக பயணம் செய்யுங்கள். அவசர உதவிக்கு 112 ஐ அழைக்கவும்.`;
    }
  }
}

export interface MicSessionCallbacks {
  onListeningChange?: (isListening: boolean) => void;
  onTranscribingChange?: (isTranscribing: boolean) => void;
  onAudioLevelChange?: (level: number) => void;
  onElapsedSecondsChange?: (seconds: number) => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onPermissionBlocked?: () => void;
  onError?: (message: string) => void;
}

export interface ActiveMicSession {
  stopAndSubmit: (manualTextOverride?: string) => void;
  cancel: () => void;
}

let currentMicSession: ActiveMicSession | null = null;

export function stopActiveMicSession() {
  if (currentMicSession) {
    try {
      currentMicSession.cancel();
    } catch {
      // Ignore
    }
    currentMicSession = null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      resolve(res);
    };
    reader.onerror = err => reject(err);
    reader.readAsDataURL(blob);
  });
}

export function startMultilingualMicSession(
  lang: SupportedVoiceLang,
  callbacks: MicSessionCallbacks
): ActiveMicSession {
  // Stop any playing voice and cancel any previous mic session
  stopAllVoicePlayback();
  stopActiveMicSession();

  const cfg = getVoiceLanguageConfig(lang);
  let finished = false;
  const committedSegments: string[] = [];
  let currentRunFinal = '';
  let currentRunInterim = '';
  let capturedTranscript = '';

  let silenceAfterSpeechTimer: ReturnType<typeof setTimeout> | null = null;
  let restartRecognitionTimer: ReturnType<typeof setTimeout> | null = null;
  let levelMeterInterval: ReturnType<typeof setInterval> | null = null;
  let elapsedTimerInterval: ReturnType<typeof setInterval> | null = null;
  let elapsedSeconds = 0;

  let recognition: any = null;
  let recognitionBlocked = false;
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioContext: AudioContext | null = null;
  let hasRealAudioAnalyser = false;
  const audioChunks: BlobPart[] = [];

  const getCombinedTranscript = (): string => {
    return [...committedSegments, currentRunFinal, currentRunInterim]
      .map(s => s.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const clearTimers = () => {
    if (silenceAfterSpeechTimer) {
      clearTimeout(silenceAfterSpeechTimer);
      silenceAfterSpeechTimer = null;
    }
    if (restartRecognitionTimer) {
      clearTimeout(restartRecognitionTimer);
      restartRecognitionTimer = null;
    }
    if (levelMeterInterval) {
      clearInterval(levelMeterInterval);
      levelMeterInterval = null;
    }
    if (elapsedTimerInterval) {
      clearInterval(elapsedTimerInterval);
      elapsedTimerInterval = null;
    }
  };

  const cleanupHardware = () => {
    callbacks.onAudioLevelChange?.(0);
    if (recognition) {
      try {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onspeechstart = null;
        recognition.onsoundstart = null;
        recognition.stop();
      } catch {
        // Ignore
      }
      recognition = null;
    }
    if (audioContext) {
      try {
        audioContext.close();
      } catch {
        // Ignore
      }
      audioContext = null;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(t => t.stop());
      } catch {
        // Ignore
      }
      mediaStream = null;
    }
  };

  // Auto-submit ONLY when actual words have been transcribed and the user pauses for 2.8 seconds
  const scheduleAutoSubmitAfterWords = (delayMs: number = 2800) => {
    if (silenceAfterSpeechTimer) clearTimeout(silenceAfterSpeechTimer);
    silenceAfterSpeechTimer = setTimeout(() => {
      const full = getCombinedTranscript() || capturedTranscript.trim();
      if (!finished && full.length >= 2) {
        finalizeSession(true);
      }
    }, delayMs);
  };

  const transcribeRecordedBlob = async (blob: Blob, mimeType: string) => {
    try {
      callbacks.onTranscribingChange?.(true);
      const base64DataUrl = await blobToBase64(blob);
      const res = await fetch('/api/stt/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64DataUrl,
          mimeType,
          lang
        })
      });
      callbacks.onTranscribingChange?.(false);

      if (res.ok) {
        const data = await res.json();
        const serverText = String(data?.transcript || '').trim();
        if (serverText) {
          callbacks.onFinalTranscript(serverText);
          return;
        }
      }
      callbacks.onError?.(
        'No clear speech was detected. Keep the mic on and speak your question, or tap any quick voice topic.'
      );
    } catch {
      callbacks.onTranscribingChange?.(false);
      callbacks.onError?.(
        'Could not transcribe audio right now. Please try speaking again or type your question.'
      );
    }
  };

  const finalizeSession = (shouldSubmit: boolean, manualTextOverride?: string) => {
    if (finished) return;
    finished = true;
    clearTimers();
    callbacks.onListeningChange?.(false);

    const directSpeech = (
      manualTextOverride ||
      getCombinedTranscript() ||
      capturedTranscript
    ).trim();

    if (!shouldSubmit) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.onstop = null;
          mediaRecorder.stop();
        } catch {
          // Ignore
        }
      }
      cleanupHardware();
      callbacks.onTranscribingChange?.(false);
      return;
    }

    // 1. If SpeechRecognition (or manual input override) captured the user's spoken words, submit immediately!
    if (directSpeech) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.onstop = null;
          mediaRecorder.stop();
        } catch {
          // Ignore
        }
      }
      cleanupHardware();
      callbacks.onTranscribingChange?.(false);
      callbacks.onFinalTranscript(directSpeech);
      return;
    }

    // 2. If MediaRecorder recorded audio chunks, send to server Gemini STT
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      const recMime = mediaRecorder.mimeType || 'audio/webm';
      mediaRecorder.onstop = () => {
        cleanupHardware();
        const recordedBlob = new Blob(audioChunks, { type: recMime });
        if (recordedBlob.size > 600) {
          void transcribeRecordedBlob(recordedBlob, recMime);
        } else {
          callbacks.onTranscribingChange?.(false);
          callbacks.onError?.(
            'No speech detected yet. Tap Mic, speak your full question, and tap Send.'
          );
        }
      };
      try {
        mediaRecorder.stop();
      } catch {
        cleanupHardware();
        callbacks.onTranscribingChange?.(false);
      }
      return;
    }

    cleanupHardware();
    callbacks.onTranscribingChange?.(false);
    callbacks.onError?.(
      'No speech detected yet. Tap Mic, speak your question, or tap a voice topic below.'
    );
  };

  // Start continuous audio stream + analyser + MediaRecorder backup (NEVER terminates session on failure!)
  const attachAudioStreamIfAvailable = () => {
    if (finished) return;
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      callbacks.onPermissionBlocked?.();
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      .then(stream => {
        if (finished) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        mediaStream = stream;

        try {
          const AudioCtx =
            window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            audioContext = new AudioCtx();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            hasRealAudioAnalyser = true;

            if (levelMeterInterval) clearInterval(levelMeterInterval);
            levelMeterInterval = setInterval(() => {
              if (finished) return;
              analyser.getByteFrequencyData(dataArray);
              const voiceBins = Math.min(28, dataArray.length);
              let sum = 0;
              for (let i = 1; i < voiceBins; i++) {
                sum += dataArray[i];
              }
              const avgVoiceBand = sum / Math.max(1, voiceBins - 1);
              const normalizedLevel = Math.max(
                12,
                Math.min(100, Math.round((avgVoiceBand / 95) * 100))
              );
              callbacks.onAudioLevelChange?.(normalizedLevel);
            }, 85);
          }
        } catch {
          // Ignore AudioContext errors
        }

        try {
          const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
          ];
          const chosenType =
            supportedTypes.find(
              t =>
                typeof MediaRecorder !== 'undefined' &&
                typeof MediaRecorder.isTypeSupported === 'function' &&
                MediaRecorder.isTypeSupported(t)
            ) || '';

          mediaRecorder = chosenType
            ? new MediaRecorder(stream, { mimeType: chosenType })
            : new MediaRecorder(stream);

          mediaRecorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };

          mediaRecorder.start(250);
        } catch {
          // Keep session open even if MediaRecorder isn't supported
        }
      })
      .catch(() => {
        // Keep the chatbot mic bar open! Never abruptly close the mic UI on getUserMedia error.
        if (finished) return;
        callbacks.onPermissionBlocked?.();
      });
  };

  // Start SpeechRecognition and auto-restart it seamlessly whenever onend fires while the mic is ON
  const startOrRestartSpeechRecognition = () => {
    if (finished || recognitionBlocked) return;
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      recognitionBlocked = true;
      return;
    }

    try {
      const rec = new SpeechRecognition();
      recognition = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.lang = cfg.bcp47;

      rec.onresult = (event: any) => {
        if (finished) return;
        let finalParts = '';
        let interimParts = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const transcriptPiece = res?.[0]?.transcript || '';
          if (res.isFinal) {
            finalParts += transcriptPiece + ' ';
          } else {
            interimParts += transcriptPiece;
          }
        }
        currentRunFinal = finalParts.trim();
        currentRunInterim = interimParts.trim();

        const combined = getCombinedTranscript();
        if (combined) {
          capturedTranscript = combined;
          callbacks.onInterimTranscript?.(combined);
          if (!hasRealAudioAnalyser) {
            callbacks.onAudioLevelChange?.(84);
          }
          // Schedule auto-submit after 2.8s of silence once real words are spoken
          scheduleAutoSubmitAfterWords(2800);
        }
      };

      rec.onerror = (event: any) => {
        if (finished) return;
        const errCode = String(event?.error || '');
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          recognitionBlocked = true;
          callbacks.onPermissionBlocked?.();
        }
        // For 'no-speech', 'network', 'aborted', or 'audio-capture', do NOT stop the mic session!
        // onend will fire next and seamlessly restart recognition while the mic remains ON.
      };

      rec.onend = () => {
        if (finished) return;
        // Preserve any words recognized in this run before restarting
        const segmentToCommit = [currentRunFinal, currentRunInterim]
          .map(s => s.trim())
          .filter(Boolean)
          .join(' ')
          .trim();
        if (segmentToCommit) {
          committedSegments.push(segmentToCommit);
          currentRunFinal = '';
          currentRunInterim = '';
          capturedTranscript = getCombinedTranscript();
        }

        // Keep recognition alive continuously as long as the user hasn't stopped the mic
        if (!finished && !recognitionBlocked) {
          if (restartRecognitionTimer) clearTimeout(restartRecognitionTimer);
          restartRecognitionTimer = setTimeout(() => {
            if (!finished && !recognitionBlocked) {
              startOrRestartSpeechRecognition();
            }
          }, 150);
        }
      };

      rec.start();
    } catch {
      // If synchronous start fails, retry gently if not blocked
      if (!finished && !recognitionBlocked) {
        restartRecognitionTimer = setTimeout(() => {
          if (!finished && !recognitionBlocked) {
            startOrRestartSpeechRecognition();
          }
        }, 400);
      }
    }
  };

  // Mark mic as actively listening immediately and keep it ON until user stops or speech completes
  callbacks.onListeningChange?.(true);
  callbacks.onElapsedSecondsChange?.(0);

  // Elapsed timer so user sees continuous live recording time (00:01, 00:02...)
  elapsedTimerInterval = setInterval(() => {
    if (finished) return;
    elapsedSeconds += 1;
    callbacks.onElapsedSecondsChange?.(elapsedSeconds);
  }, 1000);

  // Animated fallback audio level meter until hardware AnalyserNode takes over
  levelMeterInterval = setInterval(() => {
    if (finished || hasRealAudioAnalyser) return;
    const base = capturedTranscript ? 65 : 26;
    const jitter = Math.floor(Math.random() * 24);
    callbacks.onAudioLevelChange?.(Math.min(96, base + jitter));
  }, 130);

  // Start SpeechRecognition AND attach hardware audio stream for live waveform + MediaRecorder backup
  startOrRestartSpeechRecognition();
  attachAudioStreamIfAvailable();

  const session: ActiveMicSession = {
    stopAndSubmit: (manualTextOverride?: string) => {
      finalizeSession(true, manualTextOverride);
    },
    cancel: () => {
      finalizeSession(false);
    }
  };

  currentMicSession = session;
  return session;
}



