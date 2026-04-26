import type { WeatherAlert } from "@/lib/weather/types";
import { AlertTriangle, AlertOctagon, Info, ShieldAlert } from "lucide-react";

interface Props { alerts: WeatherAlert[]; }

const styles = {
  info: { wrap: "bg-primary/10 border-primary/40 text-foreground", icon: Info, iconCls: "text-primary" },
  warning: { wrap: "bg-warm/15 border-warm/50 text-foreground", icon: AlertTriangle, iconCls: "text-warm" },
  severe: { wrap: "bg-destructive/15 border-destructive/50 text-foreground", icon: ShieldAlert, iconCls: "text-destructive" },
  extreme: { wrap: "bg-destructive/25 border-destructive text-foreground animate-pulse-glow", icon: AlertOctagon, iconCls: "text-destructive" },
};

export function AlertList({ alerts }: Props) {
  return (
    <div className="space-y-3">
      {alerts.map((a) => {
        const s = styles[a.level];
        const Icon = s.icon;
        return (
          <div key={a.id} className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-4 ${s.wrap}`}>
            <Icon className={`h-6 w-6 shrink-0 mt-0.5 ${s.iconCls}`} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-display font-bold">{a.title}</h4>
                <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">{a.level}</span>
              </div>
              <p className="text-sm opacity-90 mt-1">{a.message}</p>
              {a.metric && <div className="mt-2 text-xs font-mono px-2 py-1 rounded-md bg-background/60 inline-block">{a.metric}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
