import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CitySearch } from "@/components/CitySearch";
import { AlertList } from "@/components/AlertList";
import { getWeatherForCity, type WeatherBundle } from "@/lib/weather/weather.functions";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Severe Weather Alerts · SkyPulse" },
      { name: "description", content: "Localized emergency warnings derived from cross-validated weather thresholds." },
      { property: "og:title", content: "Severe Weather Alerts · SkyPulse" },
      { property: "og:description", content: "Threshold-based severe weather alerts using cross-validated multi-source data." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(q: string) {
    setLoading(true);
    setError(null);
    try {
      setBundle(await getWeatherForCity({ data: { query: q } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Emergency alerts</h1>
        <p className="mt-2 text-muted-foreground">Real-time hazard warnings for any location.</p>
        <div className="mt-6 flex justify-center">
          <CitySearch onSelect={(g) => load(g.name)} />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/40 rounded-xl p-4">{error}</div>}

      {bundle && !loading && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{bundle.weather.city}{bundle.weather.country ? `, ${bundle.weather.country}` : ""}</span>
            {" "}· {bundle.weather.tempC.toFixed(1)}°C · confidence {bundle.weather.confidence}%
          </div>
          {bundle.alerts.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <ShieldCheck className="h-10 w-10 text-aurora mx-auto mb-3" />
              <div className="font-display font-bold text-lg">All clear</div>
              <div className="text-sm text-muted-foreground mt-1">
                No active threshold alerts for this location.
              </div>
            </div>
          ) : (
            <AlertList alerts={bundle.alerts} />
          )}
        </div>
      )}

      {!bundle && !loading && !error && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Search a city above to see active alerts.
        </div>
      )}
    </div>
  );
}
