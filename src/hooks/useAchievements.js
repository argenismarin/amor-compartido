'use client';

import { useState, useCallback } from 'react';

// useAchievements — fetch de la lista de logros y detección de logros nuevos.
//
// Devuelve: { achievements, newAchievement, fetchAchievements, checkNewAchievements, clearNewAchievement }
//
// `newAchievement` es el último logro recién desbloqueado (para mostrar el
// modal "¡Logro desbloqueado!"). Se limpia automáticamente a los 4s.
// El caller puede usar useEffect sobre `newAchievement` para disparar
// efectos visuales (confeti, etc.).
export default function useAchievements(currentUser) {
  const [achievements, setAchievements] = useState([]);
  const [newAchievement, setNewAchievement] = useState(null);

  const fetchAchievements = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/achievements?userId=${currentUser.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAchievements(data);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  }, [currentUser]);

  const checkNewAchievements = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.newAchievements && data.newAchievements.length > 0) {
        const achievement = data.newAchievements[0];
        setNewAchievement(achievement);
        setTimeout(() => setNewAchievement(null), 4000);
        // Re-fetch para que la lista refleje el nuevo unlock
        fetchAchievements();
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }, [currentUser, fetchAchievements]);

  const clearNewAchievement = useCallback(() => setNewAchievement(null), []);

  return {
    achievements,
    newAchievement,
    fetchAchievements,
    checkNewAchievements,
    clearNewAchievement,
  };
}
