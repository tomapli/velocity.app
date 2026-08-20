import { Suspense } from "react";

import { LoginIntroOverlay } from "@/components/auth/login-intro-overlay";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getSessionUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <LoginIntroOverlay />
      </Suspense>
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4">
        <p className="font-heading text-lg font-semibold">Items</p>
        <div className="flex items-center gap-3">
          {user?.email ? (
            <p className="hidden text-sm text-muted-foreground sm:block">
              {user.email}
            </p>
          ) : null}
          <ThemeSwitcher />
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
