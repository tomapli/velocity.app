import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SearchX, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="absolute top-0 right-0 p-4">
        <ThemeSwitcher />
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <SearchX
                className="size-24 text-primary/20"
                strokeWidth={1.5}
              />
            </div>
            <h1 className="font-heading text-8xl font-bold tracking-tight text-primary md:text-9xl">
              404
            </h1>
          </div>

          <div className="space-y-4">
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
              This page does not exist
            </h2>
            <p className="mx-auto max-w-md text-lg text-muted-foreground">
              The link may be wrong, or the page was removed.
            </p>
          </div>

          <div className="pt-4">
            <Button asChild size="lg" className="gap-2">
              <Link href="/">
                <ArrowLeft className="size-4" />
                Back home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
