import { ItemsTable } from "@/components/items/items-table";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { getSessionUser } from "@/lib/auth/session";
import { listItems } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const items = await listItems(supabase);

  return (
    <PageShell size="medium">
      <PageHeader
        title="Shared items"
        description="Anyone signed in can add or remove rows. Changes show up live for everyone."
        count={{ value: items.length, label: items.length === 1 ? "item" : "items" }}
      />
      <ItemsTable initialItems={items} userId={user?.id ?? ""} />
    </PageShell>
  );
}
