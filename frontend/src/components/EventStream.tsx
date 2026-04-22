import { useEffect, useRef } from "react";
import { MousePointerClick, Keyboard, Globe, AlignJustify, Activity } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import clsx from "clsx";

interface Props {
  sessionId: string;
  onEventCount?: (n: number) => void;
}

const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  click: { icon: MousePointerClick, label: "click" },
  input: { icon: Keyboard, label: "input" },
  navigation: { icon: Globe, label: "nav" },
  scroll: { icon: AlignJustify, label: "scroll" },
};

const fallback = { icon: Globe, label: "event" };

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 1000) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  return `${Math.floor(diff / 60000)}m`;
}

export default function EventStream({ sessionId, onEventCount }: Props) {
  const { events, status } = useWebSocket(sessionId);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Filter only NEW_EVENTS messages
  const rawEvents = events
    .filter((m) => m.type === "NEW_EVENTS")
    .flatMap((m) => (m.events as Record<string, unknown>[]) ?? []);

  useEffect(() => {
    onEventCount?.(rawEvents.length);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawEvents.length, onEventCount]);

  return (
    <div className="flex flex-col h-full border border-mist rounded-comfortable bg-earth-gray/10 overflow-hidden shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-mist bg-earth-gray/20">
        <span className="text-[11px] font-bold text-stone-gray uppercase tracking-editorial">
          Live Workflows Activity
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-void border border-mist rounded-pill">
            <span
              className={clsx(
                "w-1.5 h-1.5 rounded-full",
                status === "connected"
                  ? "bg-ash-gray animate-pulse"
                  : status === "connecting"
                    ? "bg-stone-gray animate-pulse"
                    : "bg-earth-gray"
              )}
            />
            <span className="text-[10px] text-ash-gray font-bold uppercase tracking-widest">
              {rawEvents.length}
            </span>
          </div>
        </div>
      </div>

      {/* Event list */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 custom-scrollbar"
        style={{ maxHeight: 400 }}
      >
        {rawEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8 opacity-30">
            <Activity size={24} className="mb-4 text-stone-gray animate-pulse" />
            <p className="text-[12px] font-medium text-stone-gray max-w-[180px]">
              Synchronizing with browser Extension context...
            </p>
          </div>
        )}
        {rawEvents.map((ev, i) => {
          const t = String(ev.type ?? "");
          const meta = TYPE_META[t] ?? fallback;
          const Icon = meta.icon;
          const sel = String(ev.selector ?? ev.toUrl ?? "").slice(0, 80);
          const val = ev.type === "input" ? String(ev.value ?? "").slice(0, 40) : null;
          const ts = Number(ev.timestamp ?? Date.now());
          const host = (() => {
            try {
              return new URL(String(ev.url ?? "")).hostname.replace("www.", "");
            } catch {
              return "";
            }
          })();

          return (
            <div
              key={i}
              className="group flex flex-col gap-2 p-4 rounded-standard border border-transparent hover:border-mist hover:bg-earth-gray/10 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-tight bg-void border border-mist flex items-center justify-center text-stone-gray group-hover:text-parchment transition-colors shadow-sm">
                    <Icon size={10} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-bold text-parchment uppercase tracking-editorial leading-none mt-0.5">
                    {meta.label}
                  </span>
                  {host && (
                    <span className="text-[10px] font-medium text-stone-gray/60 lowercase tracking-normal">
                      · {host}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-stone-gray whitespace-nowrap">
                  {relativeTime(ts)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 pl-8">
                <p className="text-[13px] font-mono text-stone-gray truncate group-hover:text-ash-gray transition-colors">
                  {sel}
                </p>
                {val && (
                  <span className="text-[12px] font-mono text-parchment/60 italic overflow-hidden text-ellipsis">
                    → "{val}"
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
