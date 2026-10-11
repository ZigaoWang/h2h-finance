import { getTranslations } from "next-intl/server";
import { Panel, Section } from "@/components/ui/card";
import { listMembers } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { MemberDialogButton, MemberRow } from "./members";

export default async function MembersPage() {
  const admin = await requireAdmin();
  const t = await getTranslations("admin.members");
  const members = listMembers();
  const active = members.filter((m) => !m.removedAt).length;

  return (
    <Section title={t("title")} description={t("count", { count: active })} action={<MemberDialogButton />}>
      <Panel>
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <MemberRow key={m.id} member={{ ...m, removed: !!m.removedAt }} isSelf={m.id === admin.id} />
        ))}
      </ul>
      </Panel>
    </Section>
  );
}
