import type { AggregatedWeather, WeatherAlert } from "./types";

export function evaluateAlerts(w: AggregatedWeather): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  if (w.tempC >= 40) {
    alerts.push({
      id: "extreme-heat",
      level: "extreme",
      title: "Extreme Heat Warning",
      message: `Temperature at ${w.tempC.toFixed(1)}°C poses serious heat-stroke risk. Avoid sun exposure and stay hydrated.`,
      metric: `${w.tempC.toFixed(1)}°C`,
    });
  } else if (w.tempC >= 35) {
    alerts.push({
      id: "high-heat",
      level: "warning",
      title: "Heat Advisory",
      message: `High temperature (${w.tempC.toFixed(1)}°C). Limit strenuous outdoor activity.`,
      metric: `${w.tempC.toFixed(1)}°C`,
    });
  }

  if (w.tempC <= -15) {
    alerts.push({
      id: "extreme-cold",
      level: "extreme",
      title: "Extreme Cold Warning",
      message: `Temperature at ${w.tempC.toFixed(1)}°C — frostbite risk within minutes of exposure.`,
      metric: `${w.tempC.toFixed(1)}°C`,
    });
  } else if (w.tempC <= -5) {
    alerts.push({
      id: "freeze",
      level: "warning",
      title: "Freeze Warning",
      message: `Sub-zero conditions (${w.tempC.toFixed(1)}°C). Dress in layers.`,
      metric: `${w.tempC.toFixed(1)}°C`,
    });
  }

  if (w.windMs >= 25) {
    alerts.push({
      id: "hurricane-wind",
      level: "extreme",
      title: "Hurricane-Force Winds",
      message: `Sustained winds at ${w.windMs.toFixed(1)} m/s. Seek immediate shelter.`,
      metric: `${w.windMs.toFixed(1)} m/s`,
    });
  } else if (w.windMs >= 15) {
    alerts.push({
      id: "severe-wind",
      level: "severe",
      title: "Severe Wind Advisory",
      message: `Strong winds at ${w.windMs.toFixed(1)} m/s may cause damage and travel hazards.`,
      metric: `${w.windMs.toFixed(1)} m/s`,
    });
  }

  if (w.condition === "thunderstorm") {
    alerts.push({
      id: "thunderstorm",
      level: "severe",
      title: "Thunderstorm Active",
      message: "Lightning and heavy precipitation in the area. Avoid open spaces and tall objects.",
      metric: w.description,
    });
  }

  if (w.visibilityKm > 0 && w.visibilityKm < 1) {
    alerts.push({
      id: "low-visibility",
      level: "warning",
      title: "Low Visibility",
      message: `Visibility under ${w.visibilityKm.toFixed(1)} km — drive with caution.`,
      metric: `${w.visibilityKm.toFixed(1)} km`,
    });
  }

  if (w.uvIndex >= 8) {
    alerts.push({
      id: "uv-extreme",
      level: "warning",
      title: "Very High UV Index",
      message: `UV index ${w.uvIndex.toFixed(0)}. Use SPF 30+ and limit midday sun.`,
      metric: `UV ${w.uvIndex.toFixed(0)}`,
    });
  }

  if (w.humidity >= 90 && w.tempC >= 30) {
    alerts.push({
      id: "humidex",
      level: "warning",
      title: "Heat + Humidity Stress",
      message: `Felt temperature dangerously high (${w.feelsLikeC.toFixed(1)}°C). Risk of heat exhaustion.`,
      metric: `${w.humidity}% RH`,
    });
  }

  return alerts;
}
