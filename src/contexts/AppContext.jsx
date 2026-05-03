'use client';

// AppContext — Provider unico que expone TODO el state global de la app
// para que las nuevas rutas (/projects, /history, /settings, etc.) puedan
// consumir lo mismo que page.js sin re-fetchear ni duplicar hooks.
//
// Diseñado para que la migracion del monolito page.js a rutas separadas
// (M28) sea incremental: cada ruta consume `useApp()` y obtiene los
// fragmentos que necesita.
//
// Notas:
// - Polling, deep links y celebraciones siguen viviendo en page.js
//   porque dependen de la home (FAB, banner). El context les permite
//   reactionar a cambios en otras rutas si el usuario navega.
// - Si esto crece a >15 properties considerar splitearlo (TasksContext +
//   UIContext + UsersContext) para evitar re-renders globales.

import { createContext, useContext } from 'react';

const AppContext = createContext(null);

export function AppContextProvider({ value, children }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp() debe usarse dentro de <AppContextProvider>');
  }
  return ctx;
}
