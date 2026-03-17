import { useEffect, useRef, useCallback } from 'react';

interface UseSoundReminderOptions {
  condition: boolean;               // Quand la notification doit démarrer
  intervalMs?: number;               // Intervalle entre les sonneries (défaut 60000 = 1 minute)
  soundEnabled?: boolean;            // Toujours true dans notre cas, mais gardé pour flexibilité
  onStop?: () => void;               // Callback quand la notification s'arrête
}

export const useSoundReminder = ({
  condition,
  intervalMs = 60000,
  soundEnabled = true,
  onStop,
}: UseSoundReminderOptions) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isRingingRef = useRef(false);

  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/notification.mp3');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Erreur lecture son:', e));
    } catch (e) {
      console.error('Erreur création audio:', e);
    }
  }, [soundEnabled]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isRingingRef.current) {
      isRingingRef.current = false;
      onStop?.();
    }
  }, [onStop]);

  useEffect(() => {
    if (condition && soundEnabled && !isRingingRef.current) {
      playSound();
      isRingingRef.current = true;
      intervalRef.current = setInterval(playSound, intervalMs);
    } else if (!condition && isRingingRef.current) {
      stop();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [condition, soundEnabled, playSound, stop, intervalMs]);

  return { stop };
};