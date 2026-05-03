import { redirect } from 'next/navigation';

// /project/[id] — deep link a un proyecto específico.
// Mismo patrón que /task/[id]: redirect a la home con ?project=<id>.
// Ver page.js useEffect para el handling del query param.
export default async function ProjectDeepLink({ params }) {
  const { id } = await params;
  redirect(`/?project=${encodeURIComponent(id)}`);
}
