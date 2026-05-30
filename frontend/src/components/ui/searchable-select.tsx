import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  filterDiscoverOptions,
  type DiscoverOption,
} from "@/lib/discover-options";

export interface SearchableSelectProps {
  options: DiscoverOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => filterDiscoverOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input",
          "bg-transparent px-2.5 py-2 text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate text-left">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-[200] mt-1 w-full rounded-lg border border-border bg-popover text-popover-foreground",
            "shadow-lg ring-1 ring-foreground/10",
          )}
        >
          <div className="p-2 border-b border-border/60">
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-56 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-muted">{emptyMessage}</li>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value || "__all__"} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                        "hover:bg-muted focus-visible:bg-muted outline-none",
                        isSelected && "bg-primary/10 text-primary",
                      )}
                      onClick={() => {
                        onValueChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "size-3.5 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
