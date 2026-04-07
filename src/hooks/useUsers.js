'use client';

import { useState, useEffect, useCallback } from 'react';

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
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);

      // Restaurar usuario desde localStorage o usar el primero por default
      const savedUserId = localStorage.getItem('currentUserId');
      const savedUser = data.find((u) => u.id === parseInt(savedUserId));
      setCurrentUser(savedUser || data[0]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast?.('Error al cargar usuarios', 'error');
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const switchUser = useCallback((user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUserId', user.id);
  }, []);

  return { users, currentUser, loading, switchUser };
}
