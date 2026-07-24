import { useState, useRef, useEffect } from "react";
import { Search, X, FileText, Globe, Upload } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { useLibrarySearch, type LibraryItem } from "@/hooks/use-library";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  document: FileText,
  link: Globe,
  upload: Upload,
};

const TYPE_COLORS: Record<string, string> = {
  note: "text-brand-green",
  document: "text-blue-400",
  link: "text-amber-400",
  upload: "text-purple-400",
};

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-brand-green/20 text-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function LibrarySearchBar({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: results = [], isLoading } = useLibrarySearch(value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleFocus() {
    setFocused(true);
    if (value.trim().length >= 2) setShowResults(true);
  }

  function handleBlur() {
    setFocused(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    setShowResults(v.trim().length >= 2);
  }

  function handleClear() {
    onChange("");
    setShowResults(false);
    inputRef.current?.focus();
  }

  function handleSelectItem(item: LibraryItem) {
    setShowResults(false);
    navigate({ to: "/library/$id", params: { id: item.id } });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setShowResults(false);
      inputRef.current?.blur();
    }
  }

  const hasResults = results.length > 0;
  const showDropdown = showResults && (hasResults || isLoading);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-surface/60 px-3 transition-all duration-200",
          focused
            ? "border-brand-green/40 shadow-[0_0_0_1px_oklch(0.92_0.23_142/15%)]"
            : "border-border/60",
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search library…"
          className="h-9 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
        />
        {value && (
          <button
            onClick={handleClear}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-border/60 bg-surface shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Searching…</div>
          ) : hasResults ? (
            <div className="max-h-72 overflow-y-auto p-1.5">
              {results.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? FileText;
                const iconColor = TYPE_COLORS[item.type] ?? "text-muted-foreground";
                return (
                  <button
                    key={item.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectItem(item);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-elevated"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-elevated">
                      <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {highlightMatch(item.title, value)}
                      </p>
                      {item.content && (
                        <p className="truncate text-xs text-muted-foreground/60">
                          {highlightMatch(item.content.replace(/<[^>]+>/g, "").slice(0, 80), value)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] capitalize text-muted-foreground/40">
                      {item.type}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
