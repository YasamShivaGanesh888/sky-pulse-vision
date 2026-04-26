import type { WeatherBundle } from "@/lib/weather/weather.functions";
import { backgroundClass, compass, conditionLabel, fmt } from "@/lib/weather/ui";
import { WeatherIcon } from "./WeatherIcon";
import { Droplets, Wind, Gauge, Eye, Sun, Cloud, ThermometerSun, TrendingUp, TrendingDown, Minus, Sparkles, Brain, Bot, Clock, CalendarDays } from "lucide-react";
import { ProviderPanel } from "./ProviderPanel";
import { AlertList } from "./AlertList";
import { HourlyStrip } from "./HourlyStrip";
import { DailyForecast } from "./DailyForecast";
import { AirQualityCard } from "./AirQualityCard";
import { AstroCard } from "./AstroCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  bundle: WeatherBundle;
}

export function WeatherDashboard({ bundle }: Props) {
  const { weather: w, prediction, alerts, forecast } = bundle;
  const bg = backgroundClass(w.condition, w.isDay);

  const TrendIcon =
    prediction.trend === "rising" ? TrendingUp :
    prediction.trend === "falling" ? TrendingDown : Minus;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Hero card */}
      <div className={`relative overflow-hidden rounded-3xl ${bg} text-white shadow-elev`}>
        <div className="absolute inset-0 bg-gradient-to-br from-black/0 via-black/10 to-black/40" />
        <div className="relative px-6 sm:px-10 py-10 sm:py-14 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div>
            <div className="text-sm font-medium opacity-80 uppercase tracking-wider">
              {w.city}{w.country ? ` · ${w.country}` : ""}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <div className="text-7xl sm:text-8xl font-display font-bold tabular-nums">
                {fmt(w.tempC, 1)}°
              </div>
              <div className="text-xl opacity-80">C</div>
            </div>
            <div className="mt-1 text-lg capitalize opacity-90">{w.description}</div>
            <div className="mt-1 text-sm opacity-70">Feels like {fmt(w.feelsLikeC, 1)}°C</div>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-4">
            <div className="animate-float">
              <WeatherIcon condition={w.condition} isDay={w.isDay} className="h-28 w-28 opacity-90" />
            </div>
            <ConfidenceMeter value={w.confidence} />
          </div>
        </div>
      </div>

      {alerts.length > 0 && <AlertList alerts={alerts} />}

      {/* Tabbed forecast views */}
      <Tabs defaultValue="now" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
          <TabsTrigger value="now" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Now
          </TabsTrigger>
          <TabsTrigger value="hourly" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Hourly
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> 7-Day
          </TabsTrigger>
        </TabsList>

        <TabsContent value="now" className="space-y-6 mt-4">
          {/* Hybrid Forecast strip (AI + ML ensemble) */}
          <div className="glass rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/15 text-primary p-3">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Hybrid Forecast · Next Hour</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-display font-bold tabular-nums">{fmt(prediction.nextHourTempC, 1)}°C</span>
                    <span className={`flex items-center gap-1 text-sm ${
                      prediction.trend === "rising" ? "text-warm" :
                      prediction.trend === "falling" ? "text-cool" : "text-muted-foreground"
                    }`}>
                      <TrendIcon className="h-4 w-4" />
                      {prediction.trend}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground max-w-xl">{prediction.rationale}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs uppercase text-muted-foreground tracking-wider">Ensemble confidence</div>
                <div className="text-2xl font-display font-bold tabular-nums">{Math.round(prediction.confidence)}%</div>
              </div>
            </div>

            {prediction.ensemble && (
              <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-border/50">
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    <Brain className="h-3.5 w-3.5" /> Trained ML model
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-display font-bold tabular-nums">{fmt(prediction.ensemble.mlTempC, 1)}°C</span>
                    <span className="text-xs text-muted-foreground">conf {prediction.ensemble.mlConfidence}%</span>
                  </div>
                  {prediction.ensemble.topFactors.length > 0 && (
                    <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                      {prediction.ensemble.topFactors.map((f) => (
                        <div key={f.name} className="flex justify-between gap-2">
                          <span className="font-mono">{f.name}</span>
                          <span className={`tabular-nums ${f.contribution > 0 ? "text-warm" : "text-cool"}`}>
                            {f.contribution > 0 ? "+" : ""}{f.contribution.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" /> AI reasoning model
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-display font-bold tabular-nums">{fmt(prediction.ensemble.aiTempC, 1)}°C</span>
                    <span className="text-xs text-muted-foreground">
                      {prediction.ensemble.aiConfidence > 0 ? `conf ${prediction.ensemble.aiConfidence}%` : "offline"}
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Δ vs ML: {(prediction.ensemble.aiTempC - prediction.ensemble.mlTempC).toFixed(2)}°C
                    <br />
                    Final value is a confidence-weighted average of both models.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric icon={<Droplets />} label="Humidity" value={fmt(w.humidity, 0, "%")} />
            <Metric icon={<Wind />} label="Wind" value={`${fmt(w.windMs, 1)} m/s`} sub={compass(w.windDeg)} />
            <Metric icon={<Gauge />} label="Pressure" value={`${fmt(w.pressureHpa, 0)} hPa`} />
            <Metric icon={<Cloud />} label="Cloud cover" value={fmt(w.cloudsPct, 0, "%")} />
            <Metric icon={<Eye />} label="Visibility" value={`${fmt(w.visibilityKm, 1)} km`} />
            <Metric icon={<Sun />} label="UV Index" value={w.uvIndex > 0 ? fmt(w.uvIndex, 1) : "—"} />
            <Metric icon={<ThermometerSun />} label="Feels like" value={`${fmt(w.feelsLikeC, 1)}°C`} />
            <Metric icon={<WeatherIcon condition={w.condition} isDay={w.isDay} className="h-5 w-5" />} label="Condition" value={conditionLabel(w.condition)} />
          </div>

          <ProviderPanel providers={w.providers} confidence={w.confidence} variance={w.variance} />
        </TabsContent>

        <TabsContent value="hourly" className="space-y-6 mt-4">
          <HourlyStrip hourly={forecast.hourly} currentTempC={w.tempC} />
          {forecast.astro && <AstroCard astro={forecast.astro} />}
        </TabsContent>

        <TabsContent value="daily" className="space-y-6 mt-4">
          <DailyForecast daily={forecast.daily} />
          <AirQualityCard air={forecast.air} uvIndex={w.uvIndex} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wider font-semibold">{label}</span>
        <span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-display font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const tone = value >= 80 ? "bg-aurora" : value >= 55 ? "bg-warm" : "bg-destructive";
  return (
    <div className="glass-strong rounded-full px-4 py-2 flex items-center gap-3 text-foreground min-w-[180px]">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confidence</div>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${tone} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
      <div className="text-sm font-bold tabular-nums">{value}%</div>
    </div>
  );
}
