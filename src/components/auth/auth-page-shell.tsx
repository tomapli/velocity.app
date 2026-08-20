import type { ReactNode } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";

interface AuthPageShellProps {
  children: ReactNode;
}

/**
 * Centered public auth layout with the theme switcher in the corner.
 */
export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="absolute top-0 right-0 p-4 md:p-6">
        <ThemeSwitcher />
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">{children}</div>
      </div>
    </main>
  );
}
