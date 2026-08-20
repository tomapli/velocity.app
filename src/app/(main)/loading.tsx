import { VelocityLogo } from "@/components/brand/velocity-logo";

const LOADING_LABEL = "Loading";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <span role="status" aria-label={LOADING_LABEL}>
        <VelocityLogo size="loading" motion="spin" decorative />
      </span>
    </div>
  );
}
