import { NavLink, Outlet } from "react-router-dom";
import { Zap, LayoutDashboard, Mic, Wifi, WifiOff } from "lucide-react";
import { useExtension } from "@/hooks/useExtension";
import clsx from "clsx";

const NAV = [{ to: "/", label: "Dashboard", icon: LayoutDashboard }];

export default function Layout() {
  const ext = useExtension();

  return (
    <div className="min-h-screen bg-void text-parchment font-sans selection:bg-parchment/10 selection:text-parchment">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-void/80 backdrop-blur-xl border-b border-mist">
        <div className="max-w-[1560px] mx-auto px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-standard bg-parchment flex items-center justify-center flex-shrink-0">
                <Zap size={16} className="text-void fill-current" />
              </div>
              <span className="font-sans font-medium text-[22px] tracking-[-0.6px] text-parchment">
                Autoverse
              </span>
            </NavLink>

            {/* Nav Items */}
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "px-6 h-16 flex items-center text-[16px] font-medium transition-all relative group",
                      isActive ? "text-parchment" : "text-stone-gray hover:text-ash-gray"
                    )
                  }
                >
                  {item.label}
                  <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-parchment scale-x-0 group-hover:scale-x-50 transition-transform origin-left" />
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Extension / Status */}
          <div className="flex items-center gap-6">
            {ext.isRecording && (
              <div className="flex items-center gap-2.5 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-pill">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <span className="text-[11px] font-bold text-red-400 uppercase tracking-editorial">
                  Recording
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {ext.isInstalled ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-earth-gray border border-mist rounded-pill">
                  <Wifi size={13} className="text-ash-gray" />
                  <span className="text-[11px] font-bold text-ash-gray uppercase tracking-editorial">
                    Extension Connected
                  </span>
                </div>
              ) : (
                <a
                  href="chrome://extensions"
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-2.5 bg-parchment text-void rounded-pill text-[14px] font-bold hover:brightness-90 transition-all"
                >
                  Connect Extension
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1560px] mx-auto pt-24 pb-12 px-10">
        <Outlet />
      </main>
    </div>
  );
}
