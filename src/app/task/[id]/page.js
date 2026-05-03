import { redirect } from 'next/navigation';

// /task/[id] — deep link a una tarea específica.
//
// Hoy redirige a la home con ?task=<id> en la URL. La home detecta el
// query param y abre el modal de edición de esa tarea automáticamente
// (ver useEffect en page.js que escucha searchParams).
//
// Razón del redirect en vez de renderizar aquí: el SPA principal (page.js)
// tiene TODO el state de tareas/proyectos/users. Replicarlo en una ruta
// separada duplicaría lógica. Con esta indirección, el deep link funciona
// (compartible por URL) sin re-arquitectar nada.
//
// Cuando se haga la migración a App Router (M28), esta página puede
// renderizar la tarea directamente.
export default async function TaskDeepLink({ params }) {
  const { id } = await params;
  redirect(`/?task=${encodeURIComponent(id)}`);
}
