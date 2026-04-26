"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Table2,
  BarChart3,
  Layers,
  TrendingUp,
  Newspaper,
  Bot,
  FileText,
  ChevronLeft,
  ChevronRight,
  Activity,
  Gauge,
  Menu,
  X,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "Data Explorer", icon: Table2, href: "/explore" },
  { label: "Dashboard", icon: BarChart3, href: "/dashboard" },
  { label: "Regimes", icon: Layers, href: "/regimes" },
  { label: "Forecast & SHAP", icon: TrendingUp, href: "/forecast" },
  { label: "Simulator", icon: Gauge, href: "/simulate" },
  { label: "News & NLP", icon: Newspaper, href: "/news" },
  { label: "AI Agent", icon: Bot, href: "/agent" },
  { label: "Blog", icon: PenLine, href: "/blog" },
  { label: "Report", icon: FileText, href: "/report" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  // openedAt tracks the pathname where the drawer was opened; if the route
  // changes, the derived `mobileOpen` is automatically false without
  // using a setState-in-effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const pathname = usePathname();
  const mobileOpen = openedAt !== null && openedAt === pathname;

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2 py-4">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-accent" : "text-slate-500"
                  )}
                />
                {(!collapsed || mobileOpen) && (
                  <span className="truncate">{item.label}</span>
                )}
                {isActive && (!collapsed || mobileOpen) && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const header = (
    <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
        <Activity className="h-4 w-4 text-white" />
      </div>
      {(!collapsed || mobileOpen) && (
        <div className="overflow-hidden">
          <span className="block truncate text-sm font-bold text-white">WACMR Analytics</span>
          <p className="truncate text-[10px] text-slate-400">A data-science investigation</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile open button */}
      <button
        onClick={() => setOpenedAt(pathname)}
        className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 shadow lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300 lg:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {header}
        {nav}
        <div className="space-y-2 border-t border-slate-800 p-2">
          <ThemeToggle compact={collapsed} />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpenedAt(null)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900 shadow-xl transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-white">WACMR Analytics</span>
            </div>
            <button
              onClick={() => setOpenedAt(null)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {nav}
          <div className="border-t border-slate-800 p-3">
            <ThemeToggle />
          </div>
        </aside>
      </div>
    </>
  );
}
