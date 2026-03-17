import { useState, useEffect } from 'react';

interface TimerResult {
  text: string;       // Format "MM:SS"
  raw: number;        // Secondes restantes
  isExpired: boolean;
  isUrgent: boolean;  // Vrai si moins de 60 secondes
}

/**
 * Hook partagé pour le compte à rebours SLA.
 * Remplace useTimer (PatientApp) et useSlaTimer (PharmacyApp).
 * Retourne null si aucune deadline n'est fournie.
 */
const useTimer = (deadline?: string): TimerResult | null => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!deadline) return;
    const calculate = () => {
      const diff = new Date(deadline).getTime() - new Date().getTime();
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    };
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return {
    text: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`,
    raw: timeLeft,
    isExpired: timeLeft <= 0,
    isUrgent: timeLeft < 60,
  };
};

export default useTimer;