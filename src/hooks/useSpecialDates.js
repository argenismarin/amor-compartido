'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchJson } from '@/lib/api';

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
      const data = await fetchJson('/api/special-dates');
      const list = Array.isArray(data?.dates)
        ? data.dates
        : Array.isArray(data)
          ? data
          : [];
      setSpecialDates(list);
      if (data?.mesiversarioInfo) {
        setMesiversarioInfo(data.mesiversarioInfo);
      }
    } catch (error) {
      console.error('Error fetching special dates:', error);
    }
  }, []);

  // Detecta si HOY (Bogotá) coincide con alguna fecha especial guardada.
  //
  // Comparamos por strings MM-DD para evitar problemas de zona horaria.
  // Antes usábamos `new Date(specialDate.date)` (que parsea como UTC si
  // viene "YYYY-MM-DD") junto con `today.getDate()` (zona local). Cliente
  // en TZ distinta al backend podía celebrar el día anterior o siguiente.
  const checkTodaySpecialDate = useCallback(() => {
    // Local date string YYYY-MM-DD (independiente de la TZ del cliente).
    const now = new Date();
    const todayLocal =
      now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    const todayMD = todayLocal.slice(5); // "MM-DD"

    const match = specialDates.find((sd) => {
      if (!sd.date) return false;
      // sd.date puede venir como "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss…"
      // Tomamos los chars 5-10 que corresponden a "MM-DD" en ambos casos.
      return String(sd.date).slice(5, 10) === todayMD;
    });
    setTodaySpecialDate(match || null);
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
  useEffect(() => {
    fetchSpecialDates();
  }, [fetchSpecialDates]);

  // Recalcular el evento de hoy cuando cambian las fechas especiales
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
