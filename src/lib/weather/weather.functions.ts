import { createServerFn } from "@tanstack/react-start";
import type { AggregatedWeather, ForecastPrediction, WeatherAlert } from "@/lib/weather/types";
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
import { geocodeCity, reverseGeocode, type GeoResult } from "@/lib/weather/geocode.server";
import { buildForecastBundle, type ForecastBundle } from "@/lib/weather/forecast.server";

export interface WeatherBundle {
  weather: AggregatedWeather;
  prediction: ForecastPrediction;
  alerts: WeatherAlert[];
  forecast: ForecastBundle;
}

function isDayUTC(timestampISO: string, lon: number): boolean {
  // Approximate local hour from longitude offset
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

  const tasks: Promise<any>[] = [];
  tasks.push(owmKey ? fetchOpenWeatherMap(lat, lon, owmKey) : Promise.resolve({ provider: "OpenWeatherMap", ok: false, error: "no key" }));
  tasks.push(waKey ? fetchWeatherAPI(lat, lon, waKey) : Promise.resolve({ provider: "WeatherAPI", ok: false, error: "no key" }));
  tasks.push(tioKey ? fetchTomorrowIO(lat, lon, tioKey) : Promise.resolve({ provider: "Tomorrow.io", ok: false, error: "no key" }));

  const providers = await Promise.all(tasks);
  const ok = providers.filter((p) => p.ok);
  if (ok.length === 0) {
    throw new Error("All weather providers failed: " + providers.map((p) => `${p.provider}=${p.error}`).join("; "));
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

  // Confidence: based on agreement (low variance => high confidence) and provider count
  const tVar = variance(ok.map((p) => p.tempC));
  const hVar = variance(ok.map((p) => p.humidity));
  const wVar = variance(ok.map((p) => p.windMs));

  // tempC stddev to confidence: 0°C variance = 100, 4°C+ stddev = 0
  const tempScore = Math.max(0, 100 - Math.sqrt(tVar) * 25);
  const humScore = Math.max(0, 100 - Math.sqrt(hVar) * 4);
  const windScore = Math.max(0, 100 - Math.sqrt(wVar) * 15);
  const providerBonus = ok.length === 3 ? 10 : ok.length === 2 ? 0 : -25;
  const confidence = Math.min(100, Math.max(0, (tempScore * 0.5 + humScore * 0.25 + windScore * 0.25) + providerBonus));

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

export const getWeatherForCity = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => {
    if (!data?.query || typeof data.query !== "string" || data.query.length > 100) {
      throw new Error("Invalid city query");
    }
    return { query: data.query.trim() };
  })
  .handler(async ({ data }): Promise<WeatherBundle> => {
    const owmKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!owmKey) throw new Error("Geocoding unavailable: OPENWEATHERMAP_API_KEY missing.");
    const matches = await geocodeCity(data.query, owmKey, 1);
    if (!matches.length) throw new Error(`No location found for "${data.query}".`);
    const m = matches[0];
    const weather = await aggregate(m.lat, m.lon, m.name, m.country);
    const [prediction, forecast] = await Promise.all([
      predictNextHour(weather),
      buildForecastBundle(weather),
    ]);
    const alerts = evaluateAlerts(weather);
    return { weather, prediction, alerts, forecast };
  });

export const getWeatherForCoords = createServerFn({ method: "POST" })
  .inputValidator((data: { lat: number; lon: number }) => {
    if (typeof data?.lat !== "number" || typeof data?.lon !== "number") throw new Error("Invalid coords");
    if (data.lat < -90 || data.lat > 90 || data.lon < -180 || data.lon > 180) throw new Error("Out of range");
    return data;
  })
  .handler(async ({ data }): Promise<WeatherBundle> => {
    const owmKey = process.env.OPENWEATHERMAP_API_KEY;
    let cityName = `${data.lat.toFixed(2)}, ${data.lon.toFixed(2)}`;
    let country: string | undefined;
    if (owmKey) {
      const r = await reverseGeocode(data.lat, data.lon, owmKey);
      if (r) { cityName = r.name; country = r.country; }
    }
    const weather = await aggregate(data.lat, data.lon, cityName, country);
    const [prediction, forecast] = await Promise.all([
      predictNextHour(weather),
      buildForecastBundle(weather),
    ]);
    const alerts = evaluateAlerts(weather);
    return { weather, prediction, alerts, forecast };
  });

export const searchCities = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => {
    if (!data?.query || typeof data.query !== "string" || data.query.length > 100) throw new Error("Invalid query");
    return { query: data.query.trim() };
  })
  .handler(async ({ data }): Promise<GeoResult[]> => {
    const owmKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!owmKey) return [];
    if (data.query.length < 2) return [];
    return geocodeCity(data.query, owmKey, 6);
  });

// Public, browser-safe key for Leaflet tile layers (separate runtime call to keep it server-side)
export const getMapTileKey = createServerFn({ method: "GET" }).handler(async () => {
  return { owmKey: process.env.OPENWEATHERMAP_API_KEY ?? null };
});
