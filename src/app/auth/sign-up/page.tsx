import { redirect } from "next/navigation";

import { AUTH_LOGIN_PATH } from "@/lib/constants/auth";

export default function SignUpPage() {
  redirect(AUTH_LOGIN_PATH);
}
