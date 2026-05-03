'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import esMessages from '@/i18n/messages/es.json';
import enMessages from '@/i18n/messages/en.json';

// useI18n — sistema de traducciones simple sin libreria externa.
//
// Por que no next-intl: requiere middleware + reorganizar rutas con
// [locale] segments. Para una app de 2 usuarios con 2 idiomas el
// overhead no se justifica. Este sistema es ~50 LOC y cubre el 95%
// del valor:
//   - Lookup de keys con notacion punto: t('tasks.empty')
//   - Interpolacion: t('tabs.forPartner', { name: 'Argenis' })
//   - Persistencia en localStorage
//   - Detecta navigator.language como default si no hay preferencia
//
// Devuelve { lang, setLang, t } donde:
//   - lang: 'es' | 'en'
//   - setLang: cambiador
//   - t(key, vars?): traduce. Si la key no existe devuelve la key
//     misma (mas debugger-friendly que devolver '')

const MESSAGES = { es: esMessages, en: enMessages };
const SUPPORTED = ['es', 'en'];
const DEFAULT_LANG = 'es';

function getInitialLang() {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const saved = localStorage.getItem('lang-preference');
  if (saved && SUPPORTED.includes(saved)) return saved;
  const browser = (navigator.language || '').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : DEFAULT_LANG;
}

function lookup(messages, key) {
  const parts = key.split('.');
  let cur = messages;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      return null;
    }
  }
  return typeof cur === 'string' ? cur : null;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
}

export default function useI18n() {
  // Inicializamos con DEFAULT_LANG en SSR, hidratamos en client effect.
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    setLangState(getInitialLang());
  }, []);

  const setLang = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return;
    localStorage.setItem('lang-preference', next);
    setLangState(next);
    // Actualizar lang attr del <html> para a11y
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', next);
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const msg = lookup(MESSAGES[lang], key) || lookup(MESSAGES[DEFAULT_LANG], key) || key;
      return interpolate(msg, vars);
    },
    [lang]
  );

  return useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
}
