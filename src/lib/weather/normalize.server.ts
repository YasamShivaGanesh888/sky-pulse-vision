import type { ProviderReading, WeatherCondition } from "./types";

function classifyOWM(id: number): WeatherCondition {
  if (id >= 200 && id < 300) return "thunderstorm";
  if (id >= 300 && id < 400) return "drizzle";
  if (id >= 500 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "mist";
  if (id === 800) return "clear";
  return "clouds";
}

function classifyText(text: string): WeatherCondition {
  const t = text.toLowerCase();
  if (t.includes("thunder")) return "thunderstorm";
  if (t.includes("drizzle")) return "drizzle";
  if (t.includes("snow") || t.includes("sleet") || t.includes("blizzard")) return "snow";
  if (t.includes("rain") || t.includes("shower")) return "rain";
  if (t.includes("fog") || t.includes("mist") || t.includes("haze")) return "mist";
  if (t.includes("cloud") || t.includes("overcast")) return "clouds";
  return "clear";
}

// Tomorrow.io weatherCode -> condition
function classifyTomorrow(code: number): WeatherCondition {
  if ([8000].includes(code)) return "thunderstorm";
  if ([4000, 4200].includes(code)) return "drizzle";
  if ([4001, 4201].includes(code)) return "rain";
  if ([5000, 5001, 5100, 5101, 6000, 6001, 6200, 6201, 7000, 7101, 7102].includes(code)) return "snow";
  if ([2000, 2100].includes(code)) return "mist";
  if ([1000].includes(code)) return "clear";
  return "clouds";
}

export async function fetchOpenWeatherMap(
  lat: number,
  lon: number,
  apiKey: string
): Promise<ProviderReading> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d: any = await res.json();
    const w = d.weather?.[0] ?? {};
    return {
      provider: "OpenWeatherMap",
      ok: true,
      tempC: d.main?.temp,
      feelsLikeC: d.main?.feels_like,
      humidity: d.main?.humidity,
      windMs: d.wind?.speed,
      windDeg: d.wind?.deg,
      pressureHpa: d.main?.pressure,
      cloudsPct: d.clouds?.all,
      visibilityKm: typeof d.visibility === "number" ? d.visibility / 1000 : undefined,
      condition: typeof w.id === "number" ? classifyOWM(w.id) : undefined,
      description: w.description,
    };
  } catch (e) {
    return { provider: "OpenWeatherMap", ok: false, error: (e as Error).message };
  }
}

export async function fetchWeatherAPI(
  lat: number,
  lon: number,
  apiKey: string
): Promise<ProviderReading> {
  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}&aqi=no`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d: any = await res.json();
    const c = d.current;
    return {
      provider: "WeatherAPI",
      ok: true,
      tempC: c?.temp_c,
      feelsLikeC: c?.feelslike_c,
      humidity: c?.humidity,
      windMs: typeof c?.wind_kph === "number" ? c.wind_kph / 3.6 : undefined,
      windDeg: c?.wind_degree,
      pressureHpa: c?.pressure_mb,
      cloudsPct: c?.cloud,
      visibilityKm: c?.vis_km,
      uvIndex: c?.uv,
      condition: c?.condition?.text ? classifyText(c.condition.text) : undefined,
      description: c?.condition?.text,
    };
  } catch (e) {
    return { provider: "WeatherAPI", ok: false, error: (e as Error).message };
  }
}

export async function fetchTomorrowIO(
  lat: number,
  lon: number,
  apiKey: string
): Promise<ProviderReading> {
  try {
    const url = `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&units=metric&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d: any = await res.json();
    const v = d.data?.values ?? {};
    return {
      provider: "Tomorrow.io",
      ok: true,
      tempC: v.temperature,
      feelsLikeC: v.temperatureApparent,
      humidity: v.humidity,
      windMs: v.windSpeed,
      windDeg: v.windDirection,
      pressureHpa: v.pressureSurfaceLevel,
      cloudsPct: v.cloudCover,
      visibilityKm: v.visibility,
      uvIndex: v.uvIndex,
      condition: typeof v.weatherCode === "number" ? classifyTomorrow(v.weatherCode) : undefined,
      description: undefined,
    };
  } catch (e) {
    return { provider: "Tomorrow.io", ok: false, error: (e as Error).message };
  }
}

// Mode: most common condition across providers
export function mostCommonCondition(values: (WeatherCondition | undefined)[]): WeatherCondition {
  const counts = new Map<WeatherCondition, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: WeatherCondition = "clear";
  let max = 0;
  for (const [k, n] of counts) if (n > max) { max = n; best = k; }
  return best;
}

export function weightedAverage(values: (number | undefined)[]): number {
  const valid = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function variance(values: (number | undefined)[]): number {
  const valid = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (valid.length < 2) return 0;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  return valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
}
