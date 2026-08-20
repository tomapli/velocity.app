"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AUTH_LOGIN_PATH } from "@/lib/constants/auth";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(AUTH_LOGIN_PATH);
  };

  return (
    <Button onClick={logout} variant="outline" size="sm">
      Log out
    </Button>
  );
}
