export interface GeoResult {
  name: string;
  country?: string;
  state?: string;
  lat: number;
  lon: number;
}

export async function geocodeCity(query: string, apiKey: string, limit = 5): Promise<GeoResult[]> {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=${limit}&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
  const data: any[] = await res.json();
  return data.map((d) => ({
    name: d.name,
    country: d.country,
    state: d.state,
    lat: d.lat,
    lon: d.lon,
  }));
}

export async function reverseGeocode(lat: number, lon: number, apiKey: string): Promise<GeoResult | null> {
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any[] = await res.json();
  const d = data[0];
  if (!d) return null;
  return { name: d.name, country: d.country, state: d.state, lat: d.lat, lon: d.lon };
}
