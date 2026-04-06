'use client';

import { useState, useCallback } from 'react';

// useStreak — fetch del streak (current_streak / best_streak) de un usuario.
//
// Devuelve: { streak, fetchStreak }
//
// El hook NO carga automáticamente al montar; deja al caller decidir cuándo
// (típicamente cuando currentUser cambia o cuando se completa una tarea).
export default function useStreak(currentUser) {
  const [streak, setStreak] = useState({ current_streak: 0, best_streak: 0 });

  const fetchStreak = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/streaks?userId=${currentUser.id}`);
      const data = await res.json();
      setStreak(data);
    } catch (error) {
      console.error('Error fetching streak:', error);
    }
  }, [currentUser]);

  return { streak, fetchStreak };
}
