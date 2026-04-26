import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Popup, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useServerFn } from "@tanstack/react-start";
import { getWeatherForCoords, type WeatherBundle } from "@/lib/weather/weather.functions";
import { Thermometer, CloudRain, Cloud, Wind, Gauge, Layers, Loader2, X, Trash2, Locate, Crosshair } from "lucide-react";
import { fmt } from "@/lib/weather/ui";
import { AlertList } from "./AlertList";
import type { WeatherAlert } from "@/lib/weather/types";

type Severity = "calm" | "info" | "warning" | "severe" | "extreme";

const MARKER_COLORS: Record<Severity, string> = {
  calm: "oklch(0.55 0.19 245)",        // primary blue
  info: "oklch(0.55 0.19 245)",
  warning: "oklch(0.78 0.17 75)",       // warm amber
  severe: "oklch(0.62 0.24 25)",        // destructive
  extreme: "oklch(0.55 0.27 25)",       // deep destructive
};

function topSeverity(alerts: WeatherAlert[]): Severity {
  if (alerts.some((a) => a.level === "extreme")) return "extreme";
  if (alerts.some((a) => a.level === "severe")) return "severe";
  if (alerts.some((a) => a.level === "warning")) return "warning";
  if (alerts.some((a) => a.level === "info")) return "info";
  return "calm";
}

function buildIcon(severity: Severity) {
  const color = MARKER_COLORS[severity];
  const pulse = severity === "extreme" || severity === "severe";
  return L.divIcon({
    className: "skypulse-marker",
    html: `<div style="position:relative;width:22px;height:22px;">
      ${pulse ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:.35;animation:skypulse-ping 1.6s cubic-bezier(0,0,.2,1) infinite;"></span>` : ""}
      <div style="position:relative;width:22px;height:22px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 2px ${color}66, 0 4px 12px rgba(0,0,0,.4);"></div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

type LayerKey = "none" | "temp_new" | "precipitation_new" | "clouds_new" | "wind_new" | "pressure_new";

const LAYERS: { key: LayerKey; label: string; icon: React.ReactNode }[] = [
  { key: "none", label: "None", icon: <Layers className="h-4 w-4" /> },
  { key: "temp_new", label: "Temperature", icon: <Thermometer className="h-4 w-4" /> },
  { key: "precipitation_new", label: "Precipitation", icon: <CloudRain className="h-4 w-4" /> },
  { key: "clouds_new", label: "Clouds", icon: <Cloud className="h-4 w-4" /> },
  { key: "wind_new", label: "Wind", icon: <Wind className="h-4 w-4" /> },
  { key: "pressure_new", label: "Pressure", icon: <Gauge className="h-4 w-4" /> },
];

interface PinnedReading {
  pos: [number, number];
  bundle: WeatherBundle;
  severity: Severity;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 5), { duration: 0.8 });
  }, [position, map]);
  return null;
}

function MapRefBridge({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

interface Props { owmKey: string | null; }

export function ExploreMap({ owmKey }: Props) {
  const [active, setActive] = useState<LayerKey>("temp_new");
  const [active_pin, setActivePin] = useState<[number, number] | null>(null);
  const [pins, setPins] = useState<PinnedReading[]>([]);
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchCoords = useServerFn(getWeatherForCoords);
  const mapRef = useRef<L.Map | null>(null);

  const overlay = useMemo(() => {
    if (!owmKey || active === "none") return null;
    return `https://tile.openweathermap.org/map/${active}/{z}/{x}/{y}.png?appid=${owmKey}`;
  }, [active, owmKey]);

  async function onMapClick(lat: number, lon: number) {
    // Toggle off if clicking very close to an existing pin
    const existing = pins.find(
      (p) => Math.abs(p.pos[0] - lat) < 0.5 && Math.abs(p.pos[1] - lon) < 0.5
    );
    if (existing) {
      setPins((prev) => prev.filter((p) => p !== existing));
      if (active_pin && existing.pos[0] === active_pin[0] && existing.pos[1] === active_pin[1]) {
        setActivePin(null);
        setBundle(null);
      }
      return;
    }

    setActivePin([lat, lon]);
    setLoading(true);
    setError(null);
    setBundle(null);
    try {
      const b = await fetchCoords({ data: { lat, lon } });
      const sev = topSeverity(b.alerts);
      setBundle(b);
      setPins((prev) => {
        const filtered = prev.filter(
          (p) => Math.abs(p.pos[0] - lat) > 0.1 || Math.abs(p.pos[1] - lon) > 0.1
        );
        const next: PinnedReading = { pos: [lat, lon], bundle: b, severity: sev };
        return [...filtered, next].slice(-12);
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function removePin(pin: PinnedReading) {
    setPins((prev) => prev.filter((p) => p !== pin));
    if (active_pin && pin.pos[0] === active_pin[0] && pin.pos[1] === active_pin[1]) {
      setActivePin(null);
      setBundle(null);
    }
  }

  function clearAll() {
    setPins([]);
    setActivePin(null);
    setBundle(null);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onMapClick(pos.coords.latitude, pos.coords.longitude),
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4 h-[75vh]">
      <div className="relative rounded-3xl overflow-hidden glass">
        <MapContainer
          center={[20, 0]}
          zoom={2.5}
          minZoom={2}
          maxZoom={12}
          style={{ height: "100%", width: "100%" }}
          worldCopyJump
          scrollWheelZoom
          zoomControl={false}
          zoomSnap={0.25}
          zoomDelta={0.5}
          wheelDebounceTime={20}
          wheelPxPerZoomLevel={80}
          inertia
          inertiaDeceleration={2800}
          preferCanvas
          doubleClickZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {overlay && <TileLayer url={overlay} opacity={0.7} />}
          <ClickHandler onClick={onMapClick} />
          <FlyTo position={active_pin} />
          <ZoomControl position="bottomleft" />
          <MapRefBridge onReady={(m) => { mapRef.current = m; }} />
          {pins.map((p) => (
            <Marker
              key={`${p.pos[0]}-${p.pos[1]}`}
              position={p.pos}
              icon={buildIcon(p.severity)}
              eventHandlers={{
                click: () => {
                  setActivePin(p.pos);
                  setBundle(p.bundle);
                },
              }}
            >
              <Popup>
                <div className="font-display font-bold mb-1">
                  {p.bundle.weather.city} · {fmt(p.bundle.weather.tempC, 1)}°C
                </div>
                <div className="text-xs text-muted-foreground capitalize mb-2">
                  {p.bundle.weather.description}
                </div>
                {p.bundle.alerts.length > 0 ? (
                  <ul className="space-y-1 mb-2">
                    {p.bundle.alerts.slice(0, 3).map((a) => (
                      <li key={a.id} className="text-xs">
                        <span className="font-semibold uppercase mr-1" style={{ color: MARKER_COLORS[a.level === "info" ? "info" : a.level] }}>
                          {a.level}
                        </span>
                        {a.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground mb-2">No active alerts.</div>
                )}
                <button
                  onClick={() => removePin(p)}
                  className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove pin
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Layer switcher */}
        <div className="absolute top-3 left-3 z-[400] glass-strong rounded-2xl p-1.5 flex flex-wrap gap-1 max-w-[calc(100%-1.5rem)]">
          {LAYERS.map((l) => (
            <button
              key={l.key}
              onClick={() => setActive(l.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                active === l.key
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary/70"
              }`}
            >
              {l.icon}
              <span className="hidden sm:inline">{l.label}</span>
            </button>
          ))}
        </div>

        {/* Action toolbar */}
        <div className="absolute top-3 right-3 z-[400] glass-strong rounded-2xl p-1.5 flex gap-1">
          <button
            onClick={locateMe}
            title="Use my location"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors"
          >
            <Locate className="h-4 w-4" />
            <span className="hidden sm:inline">Locate</span>
          </button>
          <button
            onClick={() => mapRef.current?.flyTo([20, 0], 2.5, { duration: 0.8 })}
            title="Reset view"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors"
          >
            <Crosshair className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          {pins.length > 0 && (
            <button
              onClick={clearAll}
              title="Clear all pins"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* Severity legend */}
        <div className="absolute bottom-3 right-3 z-[400] glass-strong rounded-xl p-2.5 text-[11px] flex items-center gap-3">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Alerts</span>
          {(["calm", "warning", "severe", "extreme"] as Severity[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5 capitalize">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: MARKER_COLORS[s] }} />
              {s}
            </span>
          ))}
        </div>

        {!owmKey && (
          <div className="absolute bottom-16 left-3 z-[400] glass-strong rounded-xl p-3 text-xs text-muted-foreground max-w-xs">
            OpenWeatherMap key not configured — overlays disabled.
          </div>
        )}
      </div>

      {/* Side panel */}
      <aside className="glass rounded-3xl p-5 overflow-y-auto">
        <h3 className="font-display font-bold text-lg">Point reading</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Click the map to drop a pin · click a pin again to remove it · scroll to zoom · drag to pan.
        </p>

        {loading && (
          <div className="mt-8 flex flex-col items-center text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm">Aggregating sources…</span>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/40 rounded-xl p-3 flex items-start gap-2">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {bundle && !loading && (
          <div className="mt-5 space-y-4 animate-fade-up">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Location</div>
              <div className="font-display font-bold text-xl">{bundle.weather.city}{bundle.weather.country ? `, ${bundle.weather.country}` : ""}</div>
              <div className="text-xs text-muted-foreground">{bundle.weather.lat.toFixed(3)}, {bundle.weather.lon.toFixed(3)}</div>
            </div>
            <div className="rounded-2xl bg-secondary/50 p-4">
              <div className="flex items-baseline gap-2">
                <div className="text-5xl font-display font-bold tabular-nums">{fmt(bundle.weather.tempC, 1)}°</div>
                <div className="text-sm text-muted-foreground capitalize">{bundle.weather.description}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Feels like {fmt(bundle.weather.feelsLikeC, 1)}°C · confidence {bundle.weather.confidence}%</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Wind" value={`${fmt(bundle.weather.windMs, 1)} m/s`} />
              <Stat label="Humidity" value={`${fmt(bundle.weather.humidity, 0)}%`} />
              <Stat label="Pressure" value={`${fmt(bundle.weather.pressureHpa, 0)} hPa`} />
              <Stat label="Clouds" value={`${fmt(bundle.weather.cloudsPct, 0)}%`} />
            </div>
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
              <div className="text-xs uppercase tracking-wider text-primary font-semibold">Hybrid · Next hour</div>
              <div className="mt-1 font-display font-bold text-2xl tabular-nums">{fmt(bundle.prediction.nextHourTempC, 1)}°C</div>
              {bundle.prediction.ensemble && (
                <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
                  <span>ML <span className="font-semibold text-foreground tabular-nums">{fmt(bundle.prediction.ensemble.mlTempC, 1)}°</span></span>
                  <span>AI <span className="font-semibold text-foreground tabular-nums">{fmt(bundle.prediction.ensemble.aiTempC, 1)}°</span></span>
                  <span>conf <span className="font-semibold text-foreground tabular-nums">{bundle.prediction.confidence}%</span></span>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1.5">{bundle.prediction.rationale}</div>
            </div>

            {bundle.alerts.length > 0 ? (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Active alerts ({bundle.alerts.length})
                </div>
                <AlertList alerts={bundle.alerts} />
              </div>
            ) : (
              <div className="rounded-xl border border-aurora/30 bg-aurora/10 p-3 text-xs text-foreground">
                No active threshold alerts at this location.
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="font-display font-bold tabular-nums">{value}</div>
    </div>
  );
}
