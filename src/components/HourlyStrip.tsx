import type { HourlyPoint } from "@/lib/weather/forecast.server";
import { WeatherIcon } from "./WeatherIcon";
import { Droplets } from "lucide-react";

interface Props {
  hourly: HourlyPoint[];
  currentTempC: number;
}

export function HourlyStrip({ hourly, currentTempC }: Props) {
  const all = [{ tempC: currentTempC }, ...hourly].map((h) => h.tempC);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(1, max - min);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Next 24 Hours
        </h3>
        <span className="text-[10px] text-muted-foreground">ML-projected</span>
      </div>
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <div className="flex gap-2 min-w-max">
          <HourCell label="Now" tempC={currentTempC} min={min} range={range} />
          {hourly.map((h) => {
            const d = new Date(h.time);
            const label = d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
            return (
              <HourCell
                key={h.time}
                label={label}
                tempC={h.tempC}
                min={min}
                range={range}
                condition={h.condition}
                isDay={h.isDay}
                precipChance={h.precipChance}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HourCell({
  label,
  tempC,
  min,
  range,
  condition,
  isDay = true,
  precipChance,
}: {
  label: string;
  tempC: number;
  min: number;
  range: number;
  condition?: HourlyPoint["condition"];
  isDay?: boolean;
  precipChance?: number;
}) {
  const heightPct = ((tempC - min) / range) * 100;
  return (
    <div className="flex flex-col items-center gap-2 w-14 shrink-0">
      <div className="text-[11px] font-semibold tabular-nums text-foreground">
        {tempC.toFixed(0)}°
      </div>
      <div className="h-16 w-1 rounded-full bg-secondary relative overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-primary-glow rounded-full transition-all"
          style={{ height: `${Math.max(8, heightPct)}%` }}
        />
      </div>
      {condition ? (
        <WeatherIcon condition={condition} isDay={isDay} className="h-5 w-5 text-primary" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-primary/20" />
      )}
      {typeof precipChance === "number" && precipChance > 5 ? (
        <div className="flex items-center gap-0.5 text-[10px] text-cool tabular-nums">
          <Droplets className="h-2.5 w-2.5" />
          {precipChance}%
        </div>
      ) : (
        <div className="h-3" />
      )}
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
