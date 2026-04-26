import type { WeatherCondition } from "@/lib/weather/types";

export function backgroundClass(condition: WeatherCondition, isDay: boolean): string {
  switch (condition) {
    case "thunderstorm": return "bg-storm";
    case "rain":
    case "drizzle": return "bg-rain";
    case "snow": return "bg-snow";
    case "mist": return "bg-mist";
    case "clouds": return "bg-cloudy";
    case "clear":
    default: return isDay ? "bg-clear-day" : "bg-clear-night";
  }
}

export function conditionLabel(c: WeatherCondition): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function compass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

export function fmt(v: number, digits = 0, suffix = ""): string {
  if (!isFinite(v)) return "—";
  return v.toFixed(digits) + suffix;
}
