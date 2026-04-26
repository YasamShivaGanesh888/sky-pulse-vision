import { createFileRoute } from "@tanstack/react-router";
import {
  fetchOpenWeatherMap,
  fetchTomorrowIO,
  fetchWeatherAPI,
  mostCommonCondition,
  variance,
  weightedAverage,
} from "@/lib/weather/normalize.server";
import { evaluateAlerts } from "@/lib/weather/alerts.server";
import { predictNextHour } from "@/lib/weather/predict.server";
import { geocodeCity, reverseGeocode } from "@/lib/weather/geocode.server";
import type { AggregatedWeather, ProviderReading } from "@/lib/weather/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function isDayUTC(timestampISO: string, lon: number): boolean {
  const date = new Date(timestampISO);
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const localHour = (utcHour + lon / 15 + 24) % 24;
  return localHour >= 6 && localHour < 19;
}

async function aggregate(
  lat: number,
  lon: number,
  cityName: string,
  country?: string
): Promise<AggregatedWeather> {
  const owmKey = process.env.OPENWEATHERMAP_API_KEY;
  const waKey = process.env.WEATHERAPI_API_KEY;
  const tioKey = process.env.TOMORROWIO_API_KEY;

  const providers: ProviderReading[] = await Promise.all([
    owmKey
      ? fetchOpenWeatherMap(lat, lon, owmKey)
      : Promise.resolve<ProviderReading>({ provider: "OpenWeatherMap", ok: false, error: "no key" }),
    waKey
      ? fetchWeatherAPI(lat, lon, waKey)
      : Promise.resolve<ProviderReading>({ provider: "WeatherAPI", ok: false, error: "no key" }),
    tioKey
      ? fetchTomorrowIO(lat, lon, tioKey)
      : Promise.resolve<ProviderReading>({ provider: "Tomorrow.io", ok: false, error: "no key" }),
  ]);

  const ok = providers.filter((p) => p.ok);
  if (ok.length === 0) {
    throw new Error(
      "All weather providers failed: " + providers.map((p) => `${p.provider}=${p.error}`).join("; ")
    );
  }

  const tempC = weightedAverage(ok.map((p) => p.tempC));
  const feelsLikeC = weightedAverage(ok.map((p) => p.feelsLikeC ?? p.tempC));
  const humidity = weightedAverage(ok.map((p) => p.humidity));
  const windMs = weightedAverage(ok.map((p) => p.windMs));
  const windDeg = weightedAverage(ok.map((p) => p.windDeg));
  const pressureHpa = weightedAverage(ok.map((p) => p.pressureHpa));
  const cloudsPct = weightedAverage(ok.map((p) => p.cloudsPct));
  const visibilityKm = weightedAverage(ok.map((p) => p.visibilityKm));
  const uvIndex = weightedAverage(ok.map((p) => p.uvIndex).filter((v) => typeof v === "number"));
  const condition = mostCommonCondition(ok.map((p) => p.condition));
  const description = ok.find((p) => p.description)?.description ?? condition;

  const tVar = variance(ok.map((p) => p.tempC));
  const hVar = variance(ok.map((p) => p.humidity));
  const wVar = variance(ok.map((p) => p.windMs));

  const tempScore = Math.max(0, 100 - Math.sqrt(tVar) * 25);
  const humScore = Math.max(0, 100 - Math.sqrt(hVar) * 4);
  const windScore = Math.max(0, 100 - Math.sqrt(wVar) * 15);
  const providerBonus = ok.length === 3 ? 10 : ok.length === 2 ? 0 : -25;
  const confidence = Math.min(
    100,
    Math.max(0, tempScore * 0.5 + humScore * 0.25 + windScore * 0.25 + providerBonus)
  );

  const timestamp = new Date().toISOString();
  return {
    city: cityName,
    country,
    lat,
    lon,
    timestamp,
    isDay: isDayUTC(timestamp, lon),
    tempC,
    feelsLikeC,
    humidity,
    windMs,
    windDeg,
    pressureHpa,
    cloudsPct,
    visibilityKm,
    uvIndex,
    condition,
    description,
    confidence: Math.round(confidence),
    variance: { tempC: tVar, humidity: hVar, windMs: wVar },
    providers,
  };
}

export const Route = createFileRoute("/api/public/weather")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const city = url.searchParams.get("city");
          const latStr = url.searchParams.get("lat");
          const lonStr = url.searchParams.get("lon");
          const includePrediction = url.searchParams.get("predict") !== "false";

          let lat: number;
          let lon: number;
          let name: string;
          let country: string | undefined;

          if (latStr && lonStr) {
            lat = Number(latStr);
            lon = Number(lonStr);
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
              return new Response(JSON.stringify({ error: "Invalid lat/lon" }), { status: 400, headers: CORS });
            }
            const owmKey = process.env.OPENWEATHERMAP_API_KEY;
            name = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
            if (owmKey) {
              const r = await reverseGeocode(lat, lon, owmKey);
              if (r) { name = r.name; country = r.country; }
            }
          } else if (city) {
            if (city.length > 100) {
              return new Response(JSON.stringify({ error: "city too long" }), { status: 400, headers: CORS });
            }
            const owmKey = process.env.OPENWEATHERMAP_API_KEY;
            if (!owmKey) {
              return new Response(JSON.stringify({ error: "Geocoding unavailable" }), { status: 503, headers: CORS });
            }
            const matches = await geocodeCity(city, owmKey, 1);
            if (!matches.length) {
              return new Response(JSON.stringify({ error: `No location found for "${city}"` }), { status: 404, headers: CORS });
            }
            lat = matches[0].lat;
            lon = matches[0].lon;
            name = matches[0].name;
            country = matches[0].country;
          } else {
            return new Response(
              JSON.stringify({ error: "Provide ?city=NAME or ?lat=&lon=" }),
              { status: 400, headers: CORS }
            );
          }

          const weather = await aggregate(lat, lon, name, country);
          const alerts = evaluateAlerts(weather);
          const prediction = includePrediction ? await predictNextHour(weather) : null;

          return new Response(
            JSON.stringify({
              ok: true,
              query: { lat, lon, city: name, country },
              weather,
              prediction,
              alerts,
              meta: {
                providersUsed: weather.providers.filter((p) => p.ok).map((p) => p.provider),
                providersFailed: weather.providers.filter((p) => !p.ok).map((p) => p.provider),
                generatedAt: weather.timestamp,
              },
            }),
            { status: 200, headers: { ...CORS, "Cache-Control": "public, max-age=60" } }
          );
        } catch (e) {
          console.error("/api/public/weather error:", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: CORS }
          );
        }
      },
    },
  },
});
