import { SignUpForm } from "@/components/sign-up-form";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="absolute top-0 right-0 p-4 md:p-6">
        <ThemeSwitcher />
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="font-heading text-4xl font-bold tracking-tight text-primary">
              Create an account
            </h1>
            <p className="text-muted-foreground">
              Local email confirmation is off, so you can start immediately.
            </p>
          </div>
          <SignUpForm />
        </div>
      </div>
    </main>
  );
}
