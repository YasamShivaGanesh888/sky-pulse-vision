/**
 * Forecast & atmospheric extras module.
 *
 * - 7-day daily forecast from OpenWeatherMap One Call 3.0 (real API).
 * - 24-hour hourly forecast: ML-projected from current conditions using the
 *   ridge regression model + diurnal cycle (no extra API quota burned).
 * - Air quality from OWM Air Pollution endpoint.
 * - Sunrise/sunset from One Call.
 * - Moon phase computed deterministically (Conway's algorithm).
 */

import type { AggregatedWeather, WeatherCondition } from "./types";
import { predictNextHourML } from "./ml.server";

export interface HourlyPoint {
  /** ISO timestamp */
  time: string;
  /** Hours from now (0..23) */
  hourOffset: number;
  tempC: number;
  feelsLikeC: number;
  precipChance: number; // 0..100
  condition: WeatherCondition;
  windMs: number;
  isDay: boolean;
}

export interface DailyPoint {
  /** ISO date YYYY-MM-DD */
  date: string;
  dayLabel: string; // "Mon", "Tue"...
  tempMaxC: number;
  tempMinC: number;
  precipChance: number; // 0..100
  precipMm: number;
  windMs: number;
  humidity: number;
  uvIndex: number;
  condition: WeatherCondition;
  description: string;
  sunriseISO?: string;
  sunsetISO?: string;
  moonPhase?: number; // 0..1
}

export interface AirQuality {
  aqi: 1 | 2 | 3 | 4 | 5; // OWM scale (1=Good, 5=Very Poor)
  label: string;
  pm2_5: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
}

export interface AstroInfo {
  sunriseISO: string;
  sunsetISO: string;
  dayLengthMin: number;
  /** 0..1 fraction of daylight elapsed at the timestamp */
  dayProgress: number;
  moonPhase: number; // 0..1 (0=new, 0.25=first qtr, 0.5=full, 0.75=last qtr)
  moonPhaseLabel: string;
  moonIlluminationPct: number;
}

export interface ForecastBundle {
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  air?: AirQuality;
  astro?: AstroInfo;
}

// ---------- Condition mapping helpers ----------
function mapOwmId(id: number): WeatherCondition {
  if (id >= 200 && id < 300) return "thunderstorm";
  if (id >= 300 && id < 400) return "drizzle";
  if (id >= 500 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "mist";
  if (id === 800) return "clear";
  return "clouds";
}

// ---------- Moon phase (Conway-style approximation) ----------
function moonPhaseAt(date: Date): number {
  // Returns 0..1 fraction of synodic month
  const synodic = 29.53058867;
  // Reference new moon: 2000-01-06 18:14 UTC
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (date.getTime() - ref) / 86400000;
  const phase = ((daysSince % synodic) + synodic) % synodic;
  return phase / synodic;
}

function moonPhaseLabel(p: number): string {
  if (p < 0.03 || p > 0.97) return "New Moon";
  if (p < 0.22) return "Waxing Crescent";
  if (p < 0.28) return "First Quarter";
  if (p < 0.47) return "Waxing Gibbous";
  if (p < 0.53) return "Full Moon";
  if (p < 0.72) return "Waning Gibbous";
  if (p < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

function moonIllumination(p: number): number {
  // Cosine-based illumination, 0% new -> 100% full -> 0% new
  return Math.round(((1 - Math.cos(2 * Math.PI * p)) / 2) * 100);
}

// ---------- ML-projected 24h hourly forecast ----------
function projectHourly(w: AggregatedWeather): HourlyPoint[] {
  const points: HourlyPoint[] = [];
  let cur: AggregatedWeather = { ...w };
  const startMs = Date.parse(w.timestamp);

  for (let h = 1; h <= 24; h++) {
    const ml = predictNextHourML(cur);
    const tsMs = startMs + h * 3600_000;
    const tsISO = new Date(tsMs).toISOString();

    // Compute local hour for is_day flag
    const localHour = (new Date(tsISO).getUTCHours() + w.lon / 15 + 24) % 24;
    const isDay = localHour >= 6 && localHour < 19;

    // Heuristic precipitation chance: derives from clouds + condition + humidity
    const precipBase =
      cur.condition === "thunderstorm" ? 85 :
      cur.condition === "rain" ? 70 :
      cur.condition === "drizzle" ? 55 :
      cur.condition === "snow" ? 65 :
      cur.condition === "mist" ? 25 :
      cur.condition === "clouds" ? Math.max(10, cur.cloudsPct * 0.4) :
      Math.max(0, cur.cloudsPct * 0.15);
    const humBoost = Math.max(0, (cur.humidity - 70) * 0.6);
    const precipChance = Math.min(95, Math.round(precipBase + humBoost));

    // Feels-like roughly tracks temp delta + wind chill
    const feels = ml.nextHourTempC - Math.min(3, cur.windMs * 0.15);

    points.push({
      time: tsISO,
      hourOffset: h,
      tempC: ml.nextHourTempC,
      feelsLikeC: +feels.toFixed(1),
      precipChance,
      condition: cur.condition,
      windMs: cur.windMs,
      isDay,
    });

    // Roll the state forward for the next iteration
    cur = {
      ...cur,
      tempC: ml.nextHourTempC,
      timestamp: tsISO,
      isDay,
    };
  }

  return points;
}

// ---------- OWM One Call 3.0 (daily + sun) ----------
async function fetchOwmOneCall(lat: number, lon: number, key: string) {
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts,current&units=metric&appid=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    // Fallback to free 5-day/3-hour endpoint if One Call 3.0 not subscribed
    return fetchOwmFreeForecast(lat, lon, key);
  }
  const json: any = await res.json();
  const daily: DailyPoint[] = (json.daily ?? []).slice(0, 7).map((d: any) => {
    const date = new Date(d.dt * 1000);
    return {
      date: date.toISOString().slice(0, 10),
      dayLabel: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      tempMaxC: +d.temp.max.toFixed(1),
      tempMinC: +d.temp.min.toFixed(1),
      precipChance: Math.round((d.pop ?? 0) * 100),
      precipMm: +(d.rain ?? d.snow ?? 0).toFixed(1),
      windMs: +d.wind_speed.toFixed(1),
      humidity: d.humidity,
      uvIndex: d.uvi ?? 0,
      condition: mapOwmId(d.weather?.[0]?.id ?? 800),
      description: d.weather?.[0]?.description ?? "",
      sunriseISO: new Date(d.sunrise * 1000).toISOString(),
      sunsetISO: new Date(d.sunset * 1000).toISOString(),
      moonPhase: typeof d.moon_phase === "number" ? d.moon_phase : undefined,
    };
  });

  const astro: AstroInfo | undefined = json.daily?.[0]
    ? buildAstro(json.daily[0].sunrise * 1000, json.daily[0].sunset * 1000)
    : undefined;

  return { daily, astro };
}

// Free-tier fallback: aggregate 3-hour forecast into daily summaries
async function fetchOwmFreeForecast(lat: number, lon: number, key: string) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OWM forecast failed: ${res.status}`);
  const json: any = await res.json();

  // Group 3-hourly entries by date
  const byDate: Record<string, any[]> = {};
  for (const item of json.list ?? []) {
    const date = new Date(item.dt * 1000).toISOString().slice(0, 10);
    (byDate[date] ||= []).push(item);
  }

  const daily: DailyPoint[] = Object.entries(byDate).slice(0, 7).map(([date, items]) => {
    const temps = items.map((i) => i.main.temp);
    const pops = items.map((i) => i.pop ?? 0);
    const winds = items.map((i) => i.wind.speed);
    const hums = items.map((i) => i.main.humidity);
    // Pick the noon (or middle) entry for representative condition
    const mid = items[Math.floor(items.length / 2)];
    const dt = new Date(date + "T12:00:00Z");
    return {
      date,
      dayLabel: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      tempMaxC: +Math.max(...temps).toFixed(1),
      tempMinC: +Math.min(...temps).toFixed(1),
      precipChance: Math.round(Math.max(...pops) * 100),
      precipMm: +(items.reduce((a, b) => a + (b.rain?.["3h"] ?? b.snow?.["3h"] ?? 0), 0)).toFixed(1),
      windMs: +(winds.reduce((a, b) => a + b, 0) / winds.length).toFixed(1),
      humidity: Math.round(hums.reduce((a, b) => a + b, 0) / hums.length),
      uvIndex: 0,
      condition: mapOwmId(mid.weather?.[0]?.id ?? 800),
      description: mid.weather?.[0]?.description ?? "",
    };
  });

  // Astro from city sunrise/sunset
  const astro: AstroInfo | undefined = json.city?.sunrise && json.city?.sunset
    ? buildAstro(json.city.sunrise * 1000, json.city.sunset * 1000)
    : undefined;

  return { daily, astro };
}

function buildAstro(sunriseMs: number, sunsetMs: number): AstroInfo {
  const now = Date.now();
  const dayLengthMin = Math.round((sunsetMs - sunriseMs) / 60000);
  const dayProgress = Math.max(0, Math.min(1, (now - sunriseMs) / (sunsetMs - sunriseMs)));
  const phase = moonPhaseAt(new Date(now));
  return {
    sunriseISO: new Date(sunriseMs).toISOString(),
    sunsetISO: new Date(sunsetMs).toISOString(),
    dayLengthMin,
    dayProgress,
    moonPhase: phase,
    moonPhaseLabel: moonPhaseLabel(phase),
    moonIlluminationPct: moonIllumination(phase),
  };
}

// ---------- OWM Air Pollution ----------
async function fetchAirQuality(lat: number, lon: number, key: string): Promise<AirQuality | undefined> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const json: any = await res.json();
    const item = json.list?.[0];
    if (!item) return undefined;
    const aqi = item.main.aqi as 1 | 2 | 3 | 4 | 5;
    const labels = { 1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor" };
    return {
      aqi,
      label: labels[aqi] ?? "Unknown",
      pm2_5: item.components.pm2_5,
      pm10: item.components.pm10,
      o3: item.components.o3,
      no2: item.components.no2,
      so2: item.components.so2,
      co: item.components.co,
    };
  } catch {
    return undefined;
  }
}

// ---------- Public API ----------
export async function buildForecastBundle(w: AggregatedWeather): Promise<ForecastBundle> {
  const owmKey = process.env.OPENWEATHERMAP_API_KEY;
  const hourly = projectHourly(w);

  let daily: DailyPoint[] = [];
  let astro: AstroInfo | undefined;
  let air: AirQuality | undefined;

  if (owmKey) {
    try {
      const fc = await fetchOwmOneCall(w.lat, w.lon, owmKey);
      daily = fc.daily;
      astro = fc.astro;
    } catch (e) {
      console.error("Forecast fetch failed:", e);
    }
    air = await fetchAirQuality(w.lat, w.lon, owmKey);
  }

  // Fallback astro if One Call didn't return one (rare): compute from solar noon estimate
  if (!astro) {
    const noonUTC = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      12 - Math.round(w.lon / 15)
    );
    astro = buildAstro(noonUTC - 6 * 3600_000, noonUTC + 6 * 3600_000);
  }

  return { hourly, daily, air, astro };
}
