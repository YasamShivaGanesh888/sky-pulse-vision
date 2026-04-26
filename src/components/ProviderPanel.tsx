import type { ProviderReading } from "@/lib/weather/types";
import { fmt } from "@/lib/weather/ui";
import { CheckCircle2, XCircle, Activity } from "lucide-react";

interface Props {
  providers: ProviderReading[];
  confidence: number;
  variance: { tempC: number; humidity: number; windMs: number };
}

export function ProviderPanel({ providers, confidence, variance }: Props) {
  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg">Source Aggregation</h3>
          <p className="text-sm text-muted-foreground">
            Weighted average across {providers.filter((p) => p.ok).length}/{providers.length} live providers
          </p>
        </div>
        <div className="flex items-center gap-2 text-primary">
          <Activity className="h-4 w-4" />
          <span className="text-sm font-semibold">σT {Math.sqrt(variance.tempC).toFixed(2)}°C</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {providers.map((p) => (
          <div
            key={p.provider}
            className={`rounded-xl p-4 border transition-all ${
              p.ok ? "bg-secondary/40 border-border" : "bg-destructive/10 border-destructive/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">{p.provider}</div>
              {p.ok ? (
                <CheckCircle2 className="h-4 w-4 text-aurora" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            {p.ok ? (
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <span>Temp</span><span className="text-foreground text-right">{fmt(p.tempC ?? NaN, 1)}°C</span>
                <span>Wind</span><span className="text-foreground text-right">{fmt(p.windMs ?? NaN, 1)} m/s</span>
                <span>RH</span><span className="text-foreground text-right">{fmt(p.humidity ?? NaN, 0)}%</span>
                <span>Cond</span><span className="text-foreground text-right capitalize truncate">{p.condition ?? "—"}</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-destructive/90">{p.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
