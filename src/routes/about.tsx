import { createFileRoute } from "@tanstack/react-router";
import { Layers, Cpu, ShieldAlert, Map, Sparkles, GitBranch } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SkyPulse · Architecture & Methodology" },
      { name: "description", content: "How SkyPulse aggregates three providers, scores confidence, and forecasts with AI." },
      { property: "og:title", content: "About SkyPulse" },
      { property: "og:description", content: "Architecture & methodology behind multi-source weather intelligence." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight">
        Built like a <span className="text-gradient">forecasting lab</span>.
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        SkyPulse isn't another weather app. It's a small intelligence pipeline running entirely on the edge.
      </p>

      <div className="mt-10 grid sm:grid-cols-2 gap-5">
        <Card icon={<Layers />} title="Triple-source aggregation"
          body="Every reading queries OpenWeatherMap, WeatherAPI, and Tomorrow.io concurrently. Disparate JSON shapes are normalized into one unified schema." />
        <Card icon={<Cpu />} title="Confidence scoring"
          body="A weighted blend of inter-provider variance (temperature, humidity, wind) yields a 0–100% confidence score. More agreement → higher confidence." />
        <Card icon={<Sparkles />} title="AI next-hour forecast"
          body="Aggregated state plus temporal features are fed to Lovable AI. The model returns a typed prediction via tool-calling for next-hour temperature, trend, and rationale." />
        <Card icon={<ShieldAlert />} title="Threshold alerts engine"
          body="Cross-validated metrics are evaluated against safety thresholds — extreme heat, severe wind, low visibility, thunderstorms, UV — to surface emergency warnings." />
        <Card icon={<Map />} title="Interactive heatmaps"
          body="Leaflet renders global tile layers for temperature, precipitation, clouds, wind, and pressure. Click anywhere to pull a live aggregated reading for that point." />
        <Card icon={<GitBranch />} title="Resilient by default"
          body="If a provider degrades, the aggregator continues with the survivors and lowers confidence accordingly. No single point of failure." />
      </div>

      <div className="mt-12 glass rounded-2xl p-6">
        <h2 className="font-display font-bold text-xl">Stack</h2>
        <ul className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <li>· TanStack Start (React 19, Vite 7)</li>
          <li>· Edge server functions (Cloudflare Workers)</li>
          <li>· Tailwind v4 design tokens (oklch)</li>
          <li>· React-Leaflet 2D mapping</li>
          <li>· Lovable AI Gateway (Gemini 2.5 Flash)</li>
          <li>· Lovable Cloud secrets management</li>
        </ul>
      </div>
    </div>
  );
}

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
      <div className="rounded-xl bg-primary/15 text-primary p-2.5 inline-flex [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="mt-3 font-display font-bold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
