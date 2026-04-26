export type WeatherCondition =
  | "clear" | "clouds" | "rain" | "snow" | "thunderstorm" | "mist" | "drizzle";

export interface ProviderReading {
  provider: "OpenWeatherMap" | "WeatherAPI" | "Tomorrow.io";
  ok: boolean;
  error?: string;
  tempC?: number;
  feelsLikeC?: number;
  humidity?: number;
  windMs?: number;
  windDeg?: number;
  pressureHpa?: number;
  cloudsPct?: number;
  visibilityKm?: number;
  uvIndex?: number;
  condition?: WeatherCondition;
  description?: string;
}

export interface AggregatedWeather {
  city: string;
  country?: string;
  lat: number;
  lon: number;
  timestamp: string;
  isDay: boolean;
  // Aggregated values (weighted)
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windMs: number;
  windDeg: number;
  pressureHpa: number;
  cloudsPct: number;
  visibilityKm: number;
  uvIndex: number;
  condition: WeatherCondition;
  description: string;
  // Confidence (0-100)
  confidence: number;
  variance: {
    tempC: number;
    humidity: number;
    windMs: number;
  };
  providers: ProviderReading[];
}

export interface WeatherAlert {
  id: string;
  level: "info" | "warning" | "severe" | "extreme";
  title: string;
  message: string;
  metric: string;
}

export interface ForecastPrediction {
  nextHourTempC: number;
  trend: "rising" | "falling" | "steady";
  rationale: string;
  confidence: number;
  /** Optional breakdown of the hybrid ensemble (ML baseline + AI reasoning). */
  ensemble?: {
    mlTempC: number;
    aiTempC: number;
    mlConfidence: number;
    aiConfidence: number;
    /** Top features driving the ML prediction (feature_name → standardised contribution). */
    topFactors: { name: string; contribution: number }[];
  };
}
