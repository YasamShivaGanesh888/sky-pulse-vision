import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, Moon } from "lucide-react";
import type { WeatherCondition } from "@/lib/weather/types";

interface Props {
  condition: WeatherCondition;
  isDay: boolean;
  className?: string;
}

export function WeatherIcon({ condition, isDay, className = "h-12 w-12" }: Props) {
  const Icon = (() => {
    switch (condition) {
      case "thunderstorm": return CloudLightning;
      case "drizzle": return CloudDrizzle;
      case "rain": return CloudRain;
      case "snow": return CloudSnow;
      case "mist": return CloudFog;
      case "clouds": return Cloud;
      case "clear": return isDay ? Sun : Moon;
      default: return Sun;
    }
  })();
  return <Icon className={className} aria-label={condition} strokeWidth={1.5} />;
}
