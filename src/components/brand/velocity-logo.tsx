import {
  VELOCITY_LOGO_ALT,
  VELOCITY_LOGO_METAL_SRC,
  VELOCITY_LOGO_SPIN_SRC,
} from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

export const VELOCITY_LOGO_SIZE_CLASS = {
  header: "size-10",
  auth: "size-24",
  loading: "size-12",
} as const;

export type VelocityLogoSize = keyof typeof VELOCITY_LOGO_SIZE_CLASS;
export type VelocityLogoMotion = "metal" | "spin";

interface VelocityLogoProps {
  size: VelocityLogoSize;
  motion?: VelocityLogoMotion;
  decorative?: boolean;
  className?: string;
}

/**
 * Velocity mark in a Bedrock tile. `spin` plays the 3D loop and falls back
 * to the liquid-metal still when the user prefers reduced motion.
 */
export function VelocityLogo({
  size,
  motion = "metal",
  decorative = false,
  className,
}: VelocityLogoProps) {
  const alt = decorative ? "" : VELOCITY_LOGO_ALT;
  const tileClass = cn(
    "relative inline-flex shrink-0 overflow-hidden rounded-md bg-bedrock",
    VELOCITY_LOGO_SIZE_CLASS[size],
    className,
  );

  if (motion === "metal") {
    return (
      <span className={tileClass}>
        <img
          src={VELOCITY_LOGO_METAL_SRC}
          alt={alt}
          draggable={false}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className={tileClass}>
      <img
        src={VELOCITY_LOGO_SPIN_SRC}
        alt={alt}
        draggable={false}
        className="size-full object-cover motion-reduce:hidden"
      />
      <img
        src={VELOCITY_LOGO_METAL_SRC}
        alt=""
        draggable={false}
        className="hidden size-full object-cover motion-reduce:block"
      />
    </span>
  );
}
