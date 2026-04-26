import { useEffect, useRef, useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchCities } from "@/lib/weather/weather.functions";
import type { GeoResult } from "@/lib/weather/geocode.server";

interface Props {
  onSelect: (g: GeoResult) => void;
  defaultValue?: string;
}

export function CitySearch({ onSelect, defaultValue = "" }: Props) {
  const [q, setQ] = useState(defaultValue);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const search = useServerFn(searchCities);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await search({ data: { query: q.trim() } });
        if (!cancelled) {
          setResults(r);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search a city — Tokyo, Reykjavík, São Paulo…"
          className="w-full glass-strong rounded-full pl-11 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/60 transition-all placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full glass-strong rounded-2xl overflow-hidden animate-fade-up">
          <ul className="max-h-72 overflow-y-auto">
            {results.map((r, i) => (
              <li key={`${r.name}-${r.lat}-${r.lon}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(r);
                    setQ(`${r.name}${r.country ? `, ${r.country}` : ""}`);
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors flex items-center gap-3"
                >
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}{r.state ? `, ${r.state}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{r.country} · {r.lat.toFixed(2)}, {r.lon.toFixed(2)}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
