import type { AirQuality } from "@/lib/weather/forecast.server";
import { Wind } from "lucide-react";

interface Props {
  air?: AirQuality;
  uvIndex?: number;
}

const AQI_TONES = {
  1: { bar: "bg-aurora", text: "text-aurora", glow: "from-aurora/20" },
  2: { bar: "bg-emerald-400", text: "text-emerald-400", glow: "from-emerald-400/20" },
  3: { bar: "bg-warm", text: "text-warm", glow: "from-warm/20" },
  4: { bar: "bg-orange-500", text: "text-orange-500", glow: "from-orange-500/20" },
  5: { bar: "bg-destructive", text: "text-destructive", glow: "from-destructive/20" },
} as const;

function uvLabel(uv: number) {
  if (uv < 3) return { label: "Low", tone: "text-aurora", bar: "bg-aurora" };
  if (uv < 6) return { label: "Moderate", tone: "text-warm", bar: "bg-warm" };
  if (uv < 8) return { label: "High", tone: "text-orange-500", bar: "bg-orange-500" };
  if (uv < 11) return { label: "Very High", tone: "text-destructive", bar: "bg-destructive" };
  return { label: "Extreme", tone: "text-destructive", bar: "bg-destructive" };
}

export function AirQualityCard({ air, uvIndex = 0 }: Props) {
  const uv = uvLabel(uvIndex);
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* AQI */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-2">
            <Wind className="h-3.5 w-3.5" /> Air Quality
          </h3>
          {air && (
            <span className={`text-xs font-semibold ${AQI_TONES[air.aqi].text}`}>
              {air.label}
            </span>
          )}
        </div>
        {air ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold tabular-nums">{air.aqi}</span>
              <span className="text-xs text-muted-foreground">/ 5 EAQI</span>
            </div>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= air.aqi ? AQI_TONES[air.aqi].bar : "bg-secondary"
                  }`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              <Pollutant label="PM2.5" value={air.pm2_5} unit="µg/m³" />
              <Pollutant label="PM10" value={air.pm10} unit="µg/m³" />
              <Pollutant label="O₃" value={air.o3} unit="µg/m³" />
              <Pollutant label="NO₂" value={air.no2} unit="µg/m³" />
              <Pollutant label="SO₂" value={air.so2} unit="µg/m³" />
              <Pollutant label="CO" value={air.co} unit="µg/m³" />
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Not available</div>
        )}
      </div>

      {/* UV */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            UV Index
          </h3>
          <span className={`text-xs font-semibold ${uv.tone}`}>{uv.label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-display font-bold tabular-nums">
            {uvIndex > 0 ? uvIndex.toFixed(1) : "—"}
          </span>
          <span className="text-xs text-muted-foreground">/ 11+</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full ${uv.bar} transition-all duration-700`}
            style={{ width: `${Math.min(100, (uvIndex / 11) * 100)}%` }}
          />
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
          {uvIndex >= 6
            ? "Use SPF 30+ sunscreen, sunglasses, and seek shade midday."
            : uvIndex >= 3
              ? "Wear sunglasses; apply sunscreen if outdoors >30 min."
              : "Minimal protection needed for normal activity."}
        </div>
      </div>
    </div>
  );
}

function Pollutant({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">
        {value.toFixed(1)}
        <span className="text-[9px] text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
