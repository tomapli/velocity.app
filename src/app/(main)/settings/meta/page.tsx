import { MetaConnectionsManager } from "@/components/meta/meta-connections-manager";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

export default function MetaConnectionsPage() {
  return (
    <PageShell size="wide" className="space-y-6 py-8">
      <PageHeader
        title="Meta connections"
        description="Workspace-wide Facebook and Instagram tester logins for private Instagram insights."
      />
      <MetaConnectionsManager />
    </PageShell>
  );
}

