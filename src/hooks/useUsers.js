'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchJson } from '@/lib/api';

// useUsers — gestiona la lista de usuarios + el usuario actual.
//
// Carga los usuarios al montar y restaura el currentUser desde localStorage
// (clave 'currentUserId'). Si no hay nada guardado, usa el primero como
// default.
//
// Devuelve: { users, currentUser, loading, switchUser }
//
// El caller pasa showToast para que el hook pueda reportar errores de fetch.
export default function useUsers(showToast) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await fetchJson('/api/users');
      const list = Array.isArray(data) ? data : [];
      setUsers(list);

      // Restaurar usuario desde localStorage o usar el primero por default.
      // Comparamos como string (no parseInt) para tolerar que el backend
      // pueda devolver id como string en algún edge case (driver legacy,
      // migración, etc.) — antes el find devolvía undefined y el usuario
      // guardado se perdía silenciosamente al primer paint.
      const savedUserId = localStorage.getItem('currentUserId');
      const savedUser = savedUserId
        ? list.find((u) => String(u.id) === String(savedUserId))
        : null;
      setCurrentUser(savedUser || list[0] || null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast?.('Error al cargar usuarios', 'error');
      setLoading(false);
    }
  }, [showToast]);

  // Fetch al montar. La regla react-hooks/set-state-in-effect se queja
  // porque fetchUsers internamente llama a setState, pero ese es el patrón
  // estándar de "load data on mount" en componentes cliente sin RSC.
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const switchUser = useCallback((user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUserId', user.id);
  }, []);

  return { users, currentUser, loading, switchUser };
}
