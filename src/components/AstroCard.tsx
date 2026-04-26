import type { AstroInfo } from "@/lib/weather/forecast.server";
import { Sunrise, Sunset, Moon } from "lucide-react";

interface Props {
  astro: AstroInfo;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

export function AstroCard({ astro }: Props) {
  const progressPct = Math.round(astro.dayProgress * 100);
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Sun */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-4">
          Sunrise & Sunset
        </h3>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-warm/15 text-warm p-2">
              <Sunrise className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                Sunrise
              </div>
              <div className="text-sm font-semibold tabular-nums">{fmtTime(astro.sunriseISO)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider text-right">
                Sunset
              </div>
              <div className="text-sm font-semibold tabular-nums">{fmtTime(astro.sunsetISO)}</div>
            </div>
            <div className="rounded-lg bg-cool/15 text-cool p-2">
              <Sunset className="h-4 w-4" />
            </div>
          </div>
        </div>
        {/* Day arc */}
        <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-warm via-yellow-400 to-cool"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-warm shadow-glow"
            style={{ left: `calc(${progressPct}% - 6px)` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
          <span>Day length: {fmtDuration(astro.dayLengthMin)}</span>
          <span>{progressPct}% elapsed</span>
        </div>
      </div>

      {/* Moon */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <Moon className="h-3.5 w-3.5" /> Moon Phase
        </h3>
        <div className="flex items-center gap-4">
          <MoonGlyph phase={astro.moonPhase} illumination={astro.moonIlluminationPct} />
          <div>
            <div className="text-lg font-semibold">{astro.moonPhaseLabel}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {astro.moonIlluminationPct}% illuminated
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              Lunar cycle: day {Math.round(astro.moonPhase * 29.5)} of 29.5
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoonGlyph({ phase, illumination }: { phase: number; illumination: number }) {
  // Render moon as a circle with a curved terminator using SVG
  const isWaxing = phase < 0.5;
  const illumFrac = illumination / 100;
  // Width of the lit ellipse (negative = on the other side)
  const ellipseRx = Math.abs(2 * illumFrac - 1) * 24;
  const litColor = "hsl(45 90% 80%)";
  const darkColor = "hsl(220 20% 15%)";

  return (
    <svg viewBox="-30 -30 60 60" className="h-16 w-16 shrink-0">
      <circle cx="0" cy="0" r="24" fill={darkColor} />
      {illumFrac > 0.99 ? (
        <circle cx="0" cy="0" r="24" fill={litColor} />
      ) : illumFrac < 0.01 ? null : (
        <>
          {/* Half disk on the lit side */}
          <path
            d={`M 0 -24 A 24 24 0 ${isWaxing ? 1 : 0} 1 0 24 Z`}
            fill={litColor}
          />
          {/* Terminator ellipse */}
          <ellipse
            cx="0"
            cy="0"
            rx={ellipseRx}
            ry="24"
            fill={illumFrac < 0.5 ? darkColor : litColor}
          />
        </>
      )}
      <circle cx="0" cy="0" r="24" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
    </svg>
  );
}
