import React, { useRef, useState } from 'react';

export const useEmergencyAlarm = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const [isAlarming, setIsAlarming] = useState(false);

  const startAlarm = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (oscillatorRef.current) return; // Already running

    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioContextRef.current.currentTime + 0.5);
    osc.frequency.exponentialRampToValueAtTime(800, audioContextRef.current.currentTime + 1.0);
    
    gain.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);
    
    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);
    
    osc.start();
    oscillatorRef.current = osc;
    setIsAlarming(true);
  };

  const stopAlarm = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }
    setIsAlarming(false);
  };

  return { isAlarming, startAlarm, stopAlarm };
};
