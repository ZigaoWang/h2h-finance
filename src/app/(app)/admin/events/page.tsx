import { listEvents } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { OptionsManager } from "../options";

export default async function EventsPage() {
  await requireAdmin();
  return <OptionsManager kind="events" options={listEvents().map((e) => ({ ...e, archived: !!e.archivedAt, archivedAt: undefined }))} />;
}
