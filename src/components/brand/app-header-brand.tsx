import Link from "next/link";

import { VelocityLogo } from "@/components/brand/velocity-logo";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { VELOCITY_HOME_LABEL } from "@/lib/constants/brand";

/**
 * Logged-in header mark: spinning 3D logo linking home.
 */
export function AppHeaderBrand() {
  return (
    <Link
      href={DEFAULT_LOGGED_IN_PAGE}
      aria-label={VELOCITY_HOME_LABEL}
      className="focus-ring inline-flex rounded-md"
    >
      <VelocityLogo size="header" motion="spin" decorative />
    </Link>
  );
}
