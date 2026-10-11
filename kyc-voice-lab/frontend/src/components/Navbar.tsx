"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mic,
  Users,
  LayoutDashboard,
  History,
  ShieldCheck,
  RefreshCw,
  Activity,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { HealthCheck } from "@/types";

export default function Navbar() {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthCheck | null>(null);

  useEffect(() => {
    api
      .getHealth()
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customers", label: "Synthetic Customers", icon: Users },
    { href: "/sessions/new", label: "Start Verification", icon: Mic },
    { href: "/sessions", label: "Session History", icon: History },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-white tracking-tight block leading-tight">
                  KYC Voice Lab
                </span>
                <span className="text-[10px] text-blue-400 font-mono tracking-wider uppercase block">
                  Local Speech PoC
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {health ? (
              <div
                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono"
                title={`Database: ${health.database_ok ? "OK" : "Err"} | FFmpeg: ${
                  health.ffmpeg_available ? "OK" : "Missing"
                } | Model: ${health.speech_model_loaded ? "Loaded" : "Ready on 1st run"}`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.database_ok ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                <span className="text-slate-300 hidden sm:inline">
                  {health.ffmpeg_available ? "Engine Ready" : "FFmpeg Missing"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-amber-400/80 font-mono">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Connecting API...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
