import { cn } from "@/lib/utils";

export function ChoiceGrid<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
}: {
  value: T | null;
  onChange: (next: T) => void;
  options: { id: T; title: string; body?: string }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition-all",
              active
                ? "border-gold/50 bg-gold/10 shadow-[0_0_0_1px_rgb(214_255_61/20%)_inset]"
                : "border-white/10 bg-black/20 text-white/70 hover:border-white/25 hover:text-white",
            )}
          >
            <p className="text-sm font-semibold text-white">{option.title}</p>
            {option.body ? <p className="mt-1 text-xs leading-relaxed text-white/45">{option.body}</p> : null}
          </button>
        );
      })}
    </div>
  );
}
