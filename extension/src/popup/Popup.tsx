import { useState, useEffect, useRef } from "react";
import { Mic, Square, Loader2, CheckCircle, ExternalLink, Zap } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";
const DASHBOARD = "http://localhost:3000";

type View = "idle" | "recording" | "processing";

export default function Popup() {
  const [view, setView] = useState<View>("idle");
  const [goal, setGoal] = useState("");
  const [currentGoal, setCurrentGoal] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [currentHost, setCurrentHost] = useState("—");
  const [processingStep, setProcessingStep] = useState(1);
  const [processingSubtitle, setProcessingSubtitle] = useState("Analyzing patterns...");
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const pollRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const syncState = async () => {
    try {
      const state = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      const isRecording = state?.isRecording ?? false;
      const sid = state?.currentSessionId ?? null;

      if (isRecording && sid) {
        const res = await fetch(`${API}/api/sessions/${sid}`);
        const json = await res.json();
        const status = json.data?.status;

        setSessionId(sid);
        if (status === "processing") {
          setView("processing");
          connectWS(sid);
        } else {
          setView("recording");
          setCurrentGoal(json.data?.goal ?? "Recording in progress...");
          setEventCount(state.pendingCount ?? 0);
          updateHost();
        }
      } else {
        setView("idle");
      }
    } catch {
      setView("idle");
    }
  };

  const updateHost = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      if (tab?.url) setCurrentHost(new URL(tab.url).hostname.replace("www.", ""));
    } catch {
      setCurrentHost("—");
    }
  };

  const connectWS = (sid: string) => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`${WS_URL}/ws/sessions/${sid}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "LEARNING_STARTED") {
        setProcessingStep(2);
        setProcessingSubtitle("Identifying selectors...");
      } else if (data.type === "LEARNING_DONE") {
        setProcessingStep(3);
        setProcessingSubtitle("Workflow ready!");
        setTimeout(() => {
          chrome.tabs.create({ url: `${DASHBOARD}/workflow/${data.workflow_id}` });
          window.close();
        }, 1200);
      }
    };
  };

  // ── Listeners ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    syncState();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (view === "recording") {
      pollRef.current = window.setInterval(async () => {
        const state = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
        if (state?.isRecording) setEventCount(state.pendingCount ?? 0);
      }, 1000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [view]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!goal.trim()) return showToast("Please describe what you want to automate.", true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const res = await fetch(`${API}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          start_url: tab?.url ?? null,
          page_title: tab?.title ?? null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to create session");

      const sid = json.data.id;
      setSessionId(sid);
      setCurrentGoal(goal.trim());
      setView("recording");

      await chrome.runtime.sendMessage({ type: "START_RECORDING", sessionId: sid });
      showToast("Recording started!");
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  const handleStop = async () => {
    try {
      await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
      if (sessionId) {
        // Mark status as processing
        await fetch(`${API}/api/sessions/${sessionId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "processing" }),
        }).catch(() => {});

        // Trigger Learn trigger
        fetch(`${API}/api/sessions/${sessionId}/learn`, { method: "POST" }).catch(() => {});

        setView("processing");
        connectWS(sessionId);
      } else {
        setView("idle");
      }
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  const openDashboard = (path = "") => {
    chrome.tabs.create({ url: `${DASHBOARD}${path}` });
  };

  return (
    <div className="flex flex-col min-h-[300px] bg-void text-parchment font-sans selection:bg-parchment/10">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-mist bg-earth-gray/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-parchment rounded-tight flex items-center justify-center flex-shrink-0 shadow-sm">
            <Zap size={16} className="text-void fill-current" />
          </div>
          <div>
            <div className="text-[14px] font-bold tracking-tight text-parchment leading-none mb-1">
              Autoverse
            </div>
            <div className="text-[10px] font-bold text-stone-gray uppercase tracking-editorial leading-none">
              v1.0.0
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 bg-earth-gray/40 border border-mist rounded-pill",
            view === "recording" ? "animate-pulse" : ""
          )}
        >
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              view === "recording"
                ? "bg-ash-gray"
                : view === "processing"
                  ? "bg-stone-gray"
                  : "bg-mist"
            )}
          />
          <span className="text-[9px] font-bold text-ash-gray uppercase tracking-widest">
            {view === "recording" ? "Rec" : view === "processing" ? "Learning" : "Ready"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 flex flex-col gap-5">
        {view === "idle" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-stone-gray uppercase tracking-editorial block">
                Define Automation Goal
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe your browser task..."
                className="w-full bg-earth-gray/20 border border-mist rounded-comfortable p-4 text-ash-gray text-[13px] placeholder-stone-gray/50 focus:outline-none focus:border-parchment/30 transition-all resize-none leading-relaxed min-h-[90px]"
              />
            </div>
            <button
              onClick={handleStart}
              className="w-full py-4 bg-parchment text-void rounded-pill text-[13px] font-bold hover:brightness-90 transition-all flex items-center justify-center gap-3 shadow-none"
            >
              <div className="w-2 h-2 bg-void rounded-full" />
              Begin Recording
            </button>
          </div>
        )}

        {view === "recording" && (
          <div className="space-y-5">
            <div className="bg-earth-gray/20 border border-mist p-4 rounded-comfortable">
              <span className="text-[10px] font-bold text-stone-gray uppercase tracking-editorial block mb-2">
                Current Context
              </span>
              <p className="text-[14px] text-ash-gray leading-relaxed font-medium italic">
                "{currentGoal}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-void border border-mist rounded-comfortable p-4 text-center">
                <div className="text-[24px] font-sans font-normal text-parchment leading-none mb-1 tracking-tight">
                  {eventCount}
                </div>
                <div className="text-[9px] text-stone-gray uppercase font-bold tracking-editorial">
                  Signals
                </div>
              </div>
              <div className="bg-void border border-mist rounded-comfortable p-4 text-center overflow-hidden">
                <div className="text-[14px] font-bold text-parchment truncate mb-1">
                  {currentHost}
                </div>
                <div className="text-[9px] text-stone-gray uppercase font-bold tracking-editorial">
                  Origin
                </div>
              </div>
            </div>

            <button
              onClick={handleStop}
              className="w-full py-4 bg-earth-gray text-parchment border border-mist rounded-pill text-[13px] font-bold hover:bg-earth-gray/60 transition-all flex items-center justify-center gap-3 shadow-none"
            >
              <Square size={12} fill="currentColor" /> Finalize Recording
            </button>
          </div>
        )}

        {view === "processing" && (
          <div className="space-y-6 py-2">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border-2 border-mist border-t-parchment rounded-full animate-spin flex-shrink-0" />
              <div className="space-y-1">
                <div className="text-[14px] font-bold text-parchment leading-none">
                  Synthesizing...
                </div>
                <div className="text-[11px] text-stone-gray font-medium leading-none">
                  {processingSubtitle}
                </div>
              </div>
            </div>

            <div className="space-y-4 px-1">
              {[
                { id: 1, text: "Session Analysis" },
                { id: 2, text: "Selector Discovery" },
                { id: 3, text: "Plan Synthesis" },
              ].map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-4 text-[12px] font-mono transition-all duration-300",
                    processingStep < step.id ? "opacity-20" : "opacity-100"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-tight flex items-center justify-center text-[10px] font-bold border",
                      processingStep >= step.id
                        ? "bg-ash-gray border-mist text-void"
                        : "bg-void border-mist text-stone-gray"
                    )}
                  >
                    {processingStep > step.id ? "✓" : step.id}
                  </div>
                  <span
                    className={processingStep === step.id ? "text-parchment" : "text-stone-gray"}
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-mist bg-earth-gray/10 text-center">
        <button
          onClick={() => openDashboard()}
          className="text-stone-gray hover:text-parchment text-[11px] font-bold uppercase tracking-editorial flex items-center justify-center gap-2 mx-auto transition-colors"
        >
          System Dashboard <ExternalLink size={10} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-4 left-1/2 -translate-x-1/2 bg-earth-gray border border-mist px-5 py-3 rounded-pill text-[12px] font-bold shadow-2xl z-[9999] whitespace-nowrap",
            toast.isError ? "text-red-400" : "text-parchment"
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
