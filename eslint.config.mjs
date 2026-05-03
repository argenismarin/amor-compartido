import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // react-hooks/set-state-in-effect es nueva en Next 16.2 y demasiado
      // estricta para nuestro caso. Detecta como error patrones legítimos
      // de "load on mount" y "react to state change" en componentes
      // cliente sin React Server Components. Además su detección es
      // heurística e inestable: a veces marca la misma línea como error,
      // a veces no, lo que rompe CI inesperadamente. La desactivamos
      // hasta que tenga sentido migrar a RSC / React Query / SWR.
      "react-hooks/set-state-in-effect": "off",

      // Funciones/variables no definidas son ERROR (no warning). Esta
      // regla habría detectado el bug del refactor 3ade9dd donde
      // openNewProject/openEditProject/etc quedaron referenciadas en
      // page.js sin definición — ReferenceError en runtime al hacer
      // click en proyectos. Con max-warnings=0 + esto en error, CI
      // bloquea el merge antes de que llegue a prod.
      "no-undef": "error",
      "react/jsx-no-undef": "error",
    },
  },
]);

export default eslintConfig;
