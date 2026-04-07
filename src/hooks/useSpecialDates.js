'use client';

import { useState, useEffect, useCallback } from 'react';

// useSpecialDates — gestiona aniversarios, cumpleaños y mesiversarios.
//
// Devuelve:
//   {
//     specialDates,         // array crudo de filas {type, date, user_id, label}
//     todaySpecialDate,     // si hoy coincide con alguna fecha especial
//     mesiversarioInfo,     // { monthsTogether, daysTogether, isMesiversario, ... }
//     saveSpecialDate,      // (type, date, userId?, label?) => void
//   }
//
// El caller pasa showToast para feedback.
export default function useSpecialDates(showToast) {
  const [specialDates, setSpecialDates] = useState([]);
  const [todaySpecialDate, setTodaySpecialDate] = useState(null);
  const [mesiversarioInfo, setMesiversarioInfo] = useState(null);

  const fetchSpecialDates = useCallback(async () => {
    try {
      const res = await fetch('/api/special-dates');
      const data = await res.json();
      setSpecialDates(data.dates || data);
      if (data.mesiversarioInfo) {
        setMesiversarioInfo(data.mesiversarioInfo);
      }
    } catch (error) {
      console.error('Error fetching special dates:', error);
    }
  }, []);

  // Detecta si HOY (Bogotá) coincide con alguna fecha especial guardada
  const checkTodaySpecialDate = useCallback(() => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    for (const specialDate of specialDates) {
      const dateObj = new Date(specialDate.date);
      if (dateObj.getMonth() + 1 === todayMonth && dateObj.getDate() === todayDay) {
        setTodaySpecialDate(specialDate);
        return;
      }
    }
    setTodaySpecialDate(null);
  }, [specialDates]);

  const saveSpecialDate = useCallback(
    async (type, date, userId = null, label = null) => {
      try {
        await fetch('/api/special-dates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, date, user_id: userId, label }),
        });
        fetchSpecialDates();
        showToast?.('Fecha guardada 💕');
      } catch (error) {
        console.error('Error saving special date:', error);
        showToast?.('Error al guardar fecha', 'error');
      }
    },
    [fetchSpecialDates, showToast]
  );

  // Cargar al montar — patrón estándar de "load on mount"
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchSpecialDates();
  }, [fetchSpecialDates]);

  // Recalcular el evento de hoy cuando cambian las fechas especiales
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    checkTodaySpecialDate();
  }, [checkTodaySpecialDate]);

  return {
    specialDates,
    todaySpecialDate,
    mesiversarioInfo,
    saveSpecialDate,
  };
}
