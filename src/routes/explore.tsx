import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { ExploreMap } from "@/components/ExploreMap";
import { getMapTileKey } from "@/lib/weather/weather.functions";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Global Heatmaps · SkyPulse" },
      { name: "description", content: "Interactive global weather maps: temperature, precipitation, clouds, wind, and pressure." },
      { property: "og:title", content: "Explore Global Heatmaps · SkyPulse" },
      { property: "og:description", content: "Interactive global heatmaps powered by OpenWeatherMap tile layers." },
    ],
  }),
  loader: async () => {
    const { owmKey } = await getMapTileKey();
    return { owmKey };
  },
  component: ExplorePage,
});

function ExplorePage() {
  const { owmKey } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Explore the planet</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Toggle live global overlays. Click anywhere on the map to pull an aggregated reading for that point.
        </p>
      </div>
      <ClientOnly fallback={<div className="glass rounded-3xl h-[70vh] flex items-center justify-center text-muted-foreground">Loading map…</div>}>
        <ExploreMap owmKey={owmKey} />
      </ClientOnly>
    </div>
  );
}
