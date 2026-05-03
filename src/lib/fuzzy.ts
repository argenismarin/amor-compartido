// Matcher fuzzy minimalista para titulos/descripciones de tareas.
//
// Por que no Fuse.js: 30KB para una app de 2 usuarios con un pequeño
// numero de tareas es overkill. Este matcher cubre los casos comunes:
//   - Substring case-insensitive (ya cubria el includes() previo)
//   - Acentos: normaliza con Unicode NFD + strip diacritics
//   - Subsecuencia: "comlimp" matchea "compras de limpieza"
//   - Multi-word: "lim cas" matchea "limpiar casa" (cada token presente)
//
// Devuelve true/false. Si en el futuro queremos rankear resultados por
// relevancia, agregamos score; por ahora basta filtro binario.

function normalize(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos
}

// Subsecuencia: chequea si los chars de needle aparecen en haystack
// en el mismo orden (no necesariamente contiguos).
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/**
 * Matchea query contra texto. Tres niveles de match (cualquiera vale):
 *   1. Substring directo (ej: "comp" en "compras")
 *   2. Cada palabra del query es substring (ej: "lim cas" en "limpiar casa")
 *   3. Subsecuencia (ej: "comlim" en "compras de limpieza")
 */
export function fuzzyMatch(query: string, text: string | null | undefined): boolean {
  if (!query || !query.trim()) return true;
  const q = normalize(query);
  const t = normalize(text);
  if (!t) return false;

  // Nivel 1: substring directo
  if (t.includes(q)) return true;

  // Nivel 2: cada token presente como substring
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((tk) => t.includes(tk))) return true;

  // Nivel 3: subsecuencia (caracteres en orden, no necesariamente contiguos)
  // Solo si el query es razonablemente corto, sino el match es ruidoso.
  if (q.length <= 12 && isSubsequence(q.replace(/\s/g, ''), t)) return true;

  return false;
}
