import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CitySearch } from "@/components/CitySearch";
import { WeatherDashboard } from "@/components/WeatherDashboard";
import { getWeatherForCity, getWeatherForCoords, type WeatherBundle } from "@/lib/weather/weather.functions";
import { Loader2, AlertTriangle, Sparkles, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkyPulse — Live Weather Intelligence" },
      { name: "description", content: "Search any city for aggregated, AI-forecasted weather across three providers." },
    ],
  }),
  loader: async () => {
    try {
      const bundle = await getWeatherForCity({ data: { query: "London" } });
      return { initial: bundle as WeatherBundle | null, error: null as string | null };
    } catch (e) {
      return { initial: null, error: (e as Error).message };
    }
  },
  component: Index,
});

function Index() {
  const { initial, error: loaderError } = Route.useLoaderData();
  const router = useRouter();
  const [bundle, setBundle] = useState<WeatherBundle | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(loaderError);
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "granted" | "denied">("idle");
  const triedGeoRef = useRef(false);

  async function loadCity(query: string) {
    setLoading(true);
    setError(null);
    try {
      const b = await getWeatherForCity({ data: { query } });
      setBundle(b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCoords(lat: number, lon: number) {
    setLoading(true);
    setError(null);
    try {
      const b = await getWeatherForCoords({ data: { lat, lon } });
      setBundle(b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Auto-detect user location on first load (one-shot, opt-in via browser prompt).
  useEffect(() => {
    if (triedGeoRef.current) return;
    triedGeoRef.current = true;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus("granted");
        loadCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGeoStatus("denied");
      },
      { timeout: 8000, maximumAge: 5 * 60_000 }
    );
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <section className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold uppercase tracking-wider text-primary mb-5">
          <Sparkles className="h-3.5 w-3.5" />
          Multi-source · AI-augmented
        </div>
        <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight">
         <span className="text-gradient">DYNAMIC WEATHER FORECASTING WITH API INTEGRATION
.</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          SkyPulse fuses three live providers into a single confident reading — with an AI model predicting where the temperature heads next.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <CitySearch onSelect={(g) => loadCity(g.name)} defaultValue={bundle?.weather.city ?? ""} />
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) return;
              setGeoStatus("locating");
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setGeoStatus("granted");
                  loadCoords(pos.coords.latitude, pos.coords.longitude);
                },
                () => setGeoStatus("denied"),
                { timeout: 8000 }
              );
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full glass text-sm font-medium hover:bg-primary/10 transition-colors"
            title="Use my current location"
          >
            <MapPin className="h-4 w-4 text-primary" />
            {geoStatus === "locating" ? "Locating…" : "My location"}
          </button>
        </div>
        {geoStatus === "denied" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Location permission denied — search for a city instead.
          </p>
        )}
      </section>

      {loading && (
        <div className="glass rounded-3xl p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm">Aggregating sources…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 flex items-start gap-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Unable to load weather</div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
            <button
              onClick={() => router.invalidate()}
              className="mt-3 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && bundle && <WeatherDashboard bundle={bundle} />}
    </div>
  );
}
