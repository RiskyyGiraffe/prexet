import { cn } from "@/lib/utils";

function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn("h-1.5 overflow-hidden rounded-full bg-slate-200", className)}
    >
      <div
        className="h-full rounded-full bg-[var(--accent-strong)] transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export { Progress };
