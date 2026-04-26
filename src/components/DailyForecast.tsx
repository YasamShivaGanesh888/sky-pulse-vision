import type { DailyPoint } from "@/lib/weather/forecast.server";
import { WeatherIcon } from "./WeatherIcon";
import { Droplets, Wind } from "lucide-react";

interface Props {
  daily: DailyPoint[];
}

export function DailyForecast({ daily }: Props) {
  if (!daily.length) {
    return (
      <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
        7-day forecast unavailable (no provider data).
      </div>
    );
  }

  const overallMin = Math.min(...daily.map((d) => d.tempMinC));
  const overallMax = Math.max(...daily.map((d) => d.tempMaxC));
  const range = Math.max(1, overallMax - overallMin);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          7-Day Forecast
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {overallMin.toFixed(0)}° → {overallMax.toFixed(0)}°
        </span>
      </div>
      <div className="space-y-2">
        {daily.map((d, i) => {
          const lowPct = ((d.tempMinC - overallMin) / range) * 100;
          const highPct = ((d.tempMaxC - overallMin) / range) * 100;
          return (
            <div
              key={d.date}
              className="grid grid-cols-[60px_36px_1fr_60px] sm:grid-cols-[80px_40px_70px_1fr_70px] items-center gap-3 py-2 border-b border-border/40 last:border-0"
            >
              <div className="text-sm font-semibold">
                {i === 0 ? "Today" : d.dayLabel}
              </div>
              <WeatherIcon condition={d.condition} isDay className="h-6 w-6 text-primary" />
              <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
                {d.precipChance > 5 && (
                  <span className="flex items-center gap-1 text-cool tabular-nums">
                    <Droplets className="h-3 w-3" />
                    {d.precipChance}%
                  </span>
                )}
                <span className="flex items-center gap-1 tabular-nums">
                  <Wind className="h-3 w-3" />
                  {d.windMs.toFixed(0)}m/s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-cool w-7 text-right">
                  {d.tempMinC.toFixed(0)}°
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary relative overflow-hidden">
                  <div
                    className="absolute h-full rounded-full bg-gradient-to-r from-cool via-warm to-warm/80"
                    style={{ left: `${lowPct}%`, width: `${Math.max(8, highPct - lowPct)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-warm w-7">
                  {d.tempMaxC.toFixed(0)}°
                </span>
              </div>
              <div className="text-right text-[10px] text-muted-foreground capitalize hidden sm:block truncate">
                {d.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
