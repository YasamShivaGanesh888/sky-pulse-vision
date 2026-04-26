import { Link } from "@tanstack/react-router";
import { CloudSun, Map, AlertTriangle, Info } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 glass-strong border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <CloudSun className="h-7 w-7 text-primary transition-transform group-hover:rotate-12" />
            <span className="absolute -inset-1 rounded-full bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            Sky<span className="text-gradient">Pulse</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <NavLink to="/" icon={<CloudSun className="h-4 w-4" />} label="Dashboard" />
          <NavLink to="/explore" icon={<Map className="h-4 w-4" />} label="Explore" />
          <NavLink to="/alerts" icon={<AlertTriangle className="h-4 w-4" />} label="Alerts" />
          <NavLink to="/about" icon={<Info className="h-4 w-4" />} label="About" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex items-center gap-2"
      activeProps={{ className: "px-3 py-2 rounded-lg text-foreground bg-secondary/80 flex items-center gap-2" }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
