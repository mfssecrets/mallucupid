import { BadgeCheck } from "lucide-react";

/** Instagram-style verified badge. Only render when `verified` is true from the API. */
export function VerifiedBadge({
  verified,
  className = "",
  size = "md",
}: {
  verified?: boolean | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (!verified) return null;
  const dim = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  return (
    <span
      className={`inline-flex items-center justify-center text-sky-500 shrink-0 ${className}`}
      title="Verified creator"
      aria-label="Verified creator"
    >
      <BadgeCheck className={`${dim} fill-sky-500 text-white`} strokeWidth={1.5} />
    </span>
  );
}
