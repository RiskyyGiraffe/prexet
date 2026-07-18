import { cn } from "@/lib/utils";

export function PrexetMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      fill="none"
      className={cn("size-5", className)}
    >
      <path
        d="M25 13H14V51H25M39 13H50V51H39M25 32H39"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function PrexetBrand({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-sm font-semibold", className)}>
      <span className={cn("grid size-8 place-items-center rounded-lg border border-zinc-200 bg-white text-black", markClassName)}>
        <PrexetMark />
      </span>
      <span>Prexet</span>
    </span>
  );
}
