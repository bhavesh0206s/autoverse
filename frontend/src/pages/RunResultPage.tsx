import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, CheckCircle, XCircle, Clock, ChevronDown, Play } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/api/client";
import type { RunLog } from "@/types";
import clsx from "clsx";

const STATUS = {
  success: {
    label: "Execution Successful",
    indicator: "bg-ash-gray",
    banner: "bg-earth-gray/40 border-mist",
    text: "text-parchment",
  },
  failed: {
    label: "Execution Failed",
    indicator: "bg-red-500/60",
    banner: "bg-red-500/5 border-red-500/20",
    text: "text-red-400",
  },
  timeout: {
    label: "Execution Timeout",
    indicator: "bg-stone-gray",
    banner: "bg-earth-gray/30 border-mist",
    text: "text-ash-gray",
  },
  running: {
    label: "Execution in Progress",
    indicator: "bg-parchment animate-pulse",
    banner: "bg-earth-gray/40 border-mist",
    text: "text-parchment",
  },
} as const;

function isArrayOfObjects(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "object";
}

function normalizeResultData(data: any): any {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;

  const entries = Object.entries(data);

  // New Rule: If it's a single key pointing to an array of objects, just return that array
  if (entries.length === 1) {
    const value = entries[0][1];
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      return value;
    }
  }

  // Check if all values are arrays of the same length > 0
  const firstVal = entries[0][1];
  if (!Array.isArray(firstVal) || firstVal.length === 0) return data;

  const len = firstVal.length;
  const isUniform = entries.every(([_, v]) => Array.isArray(v) && v.length === len);

  if (isUniform) {
    const normalized = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, any> = {};
      for (const [k, v] of entries) {
        row[k] = (v as any[])[i];
      }
      normalized.push(row);
    }
    return normalized;
  }

  return data;
}

function ResultTable({ data }: { data: Record<string, unknown>[] }) {
  const keys = Object.keys(data[0] ?? {}).slice(0, 8);
  return (
    <div className="overflow-x-auto rounded-comfortable border border-mist bg-void shadow-none">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-mist bg-earth-gray/40">
            {keys.map((k) => (
              <th
                key={k}
                className="px-6 py-4 text-left text-stone-gray font-bold uppercase tracking-editorial border-r border-mist last:border-0"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr
              key={i}
              className="border-b border-mist/30 last:border-0 hover:bg-earth-gray/20 transition-colors"
            >
              {keys.map((k) => (
                <td
                  key={k}
                  className="px-5 py-3 text-ash-gray font-mono max-w-[300px] truncate border-r border-mist/30 last:border-0"
                >
                  {typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RunResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rawOpen, setRawOpen] = useState(false);

  const {
    data: run,
    isLoading,
    error,
  } = useQuery<RunLog>({
    queryKey: ["run", id],
    queryFn: () => api.getRun(id!),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2000 : false),
  });

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-8">
        <div className="w-12 h-12 border-2 border-mist border-t-parchment rounded-full animate-spin" />
        <p className="text-[12px] font-bold text-stone-gray uppercase tracking-editorial">
          Analyzing Execution Workflows...
        </p>
      </div>
    );

  if (error || !run)
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h1 className="text-[40px] font-sans font-normal text-parchment mb-4">Run log missing.</h1>
        <Link
          to="/"
          className="text-ash-gray hover:text-parchment underline underline-offset-8 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );

  const statusMeta = STATUS[run.status as keyof typeof STATUS] ?? STATUS.running;
  const duration = run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : null;
  const resultData = normalizeResultData(run.result?.data ?? run.result);
  const stepResults: unknown[] = Array.isArray(run.result?.step_results)
    ? (run.result!.step_results as unknown[])
    : [];
  const rawOutput = run.result?.raw_output as string | undefined;

  return (
    <div className="space-y-12">
      {/* Header Context */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-6 text-[11px] font-bold text-stone-gray uppercase tracking-editorial">
          <Link to="/" className="hover:text-parchment transition-colors">
            Nodes
          </Link>
          <span className="text-stone-gray/30">/</span>
          <Link
            to={`/workflow/${run.workflow_id}`}
            className="hover:text-parchment transition-colors max-w-[120px] truncate"
          >
            Flow
          </Link>
          <span className="text-stone-gray/30">/</span>
          <span className="text-parchment">Execution #{run.id.slice(0, 8)}</span>
        </nav>

        <button
          onClick={() => navigate(`/workflow/${run.workflow_id}`)}
          className="px-6 py-2.5 bg-earth-gray border border-mist rounded-pill text-[13px] font-bold text-parchment hover:brightness-125 transition-all"
        >
          Re-invoke Flow
        </button>
      </div>

      {/* Main Analysis Display */}
      <div className="space-y-10">
        <h1 className="text-[80px] font-sans font-normal text-parchment leading-[1.0] tracking-[-2.4px]">
          Run Analysis.
        </h1>

        <div
          className={clsx(
            "flex flex-col md:flex-row items-start md:items-center gap-8 p-8 border rounded-comfortable transition-all",
            statusMeta.banner
          )}
        >
          <div
            className={clsx(
              "w-3 h-3 rounded-full flex-shrink-0 mt-1 md:mt-0",
              statusMeta.indicator
            )}
          />
          <div className="flex-1">
            <h2
              className={clsx(
                "text-[32px] font-sans font-normal leading-none mb-4",
                statusMeta.text
              )}
            >
              {statusMeta.label}
            </h2>
            <div className="flex items-center gap-6 text-[12px] font-bold text-stone-gray uppercase tracking-editorial">
              <span>{format(new Date(run.ran_at), "PPpp")}</span>
              {duration && (
                <span className="px-2 py-0.5 border border-mist rounded-tight">
                  {duration} Duration
                </span>
              )}
            </div>
          </div>

          <Link
            to={`/workflow/${run.workflow_id}`}
            className="px-8 py-3 bg-parchment text-void rounded-pill text-[14px] font-bold hover:brightness-90 transition-all"
          >
            Workflow Definition
          </Link>
        </div>
      </div>

      <div className="h-px bg-mist" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Metadata & Steps */}
        <div className="lg:col-span-1 space-y-12">
          {stepResults.length > 0 && (
            <div className="space-y-8">
              <h3 className="text-[12px] font-bold text-stone-gray uppercase tracking-editorial border-b border-mist pb-4">
                Execution Steps
              </h3>
              <div className="space-y-6">
                {stepResults.map((s: unknown, i) => {
                  const step = s as Record<string, unknown>;
                  return (
                    <div key={i} className="flex items-center gap-5">
                      <div
                        className={clsx(
                          "w-5 h-5 rounded-tight text-[10px] font-bold flex items-center justify-center border",
                          step.status === "done"
                            ? "bg-earth-gray border-mist text-parchment"
                            : "border-mist/30 text-stone-gray"
                        )}
                      >
                        {i + 1}
                      </div>
                      <span
                        className={clsx(
                          "text-[16px] font-medium capitalize",
                          step.status === "done" ? "text-parchment" : "text-stone-gray"
                        )}
                      >
                        {String(step.status ?? "Scheduled")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {run.error && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-comfortable p-8 space-y-4">
              <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-editorial">
                Extension Error Log
              </h3>
              <p className="text-[14px] text-red-300 font-mono leading-relaxed break-words">
                {run.error}
              </p>
            </div>
          )}
        </div>

        {/* Right: Data Display */}
        <div className="lg:col-span-2 space-y-12">
          {resultData && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-mist pb-4">
                <h3 className="text-[12px] font-bold text-stone-gray uppercase tracking-editorial">
                  Extracted Intelligence
                </h3>
                {Array.isArray(resultData) && (
                  <span className="text-[10px] font-bold text-stone-gray bg-earth-gray border border-mist px-3 py-1 rounded-pill uppercase tracking-widest">
                    {resultData.length} records
                  </span>
                )}
              </div>

              {isArrayOfObjects(resultData) ? (
                <ResultTable data={resultData} />
              ) : (
                <div className="bg-earth-gray/20 border border-mist rounded-comfortable p-8">
                  <pre className="text-[15px] text-ash-gray font-mono overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap leading-relaxed selection:bg-parchment/20">
                    {JSON.stringify(resultData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Raw output collapsible */}
          {rawOutput && (
            <div className="bg-earth-gray/10 border border-mist rounded-comfortable overflow-hidden transition-all duration-500">
              <button
                onClick={() => setRawOpen((v) => !v)}
                className="w-full flex items-center justify-between px-8 py-5 text-[12px] font-bold text-stone-gray uppercase tracking-editorial hover:bg-earth-gray/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-gray" />
                  System Console Output
                </div>
                <ChevronDown
                  size={16}
                  className={clsx("transition-transform duration-300", rawOpen ? "rotate-180" : "")}
                />
              </button>
              {rawOpen && (
                <div className="px-8 pb-8 pt-2 border-t border-mist/30 bg-void/50">
                  <pre className="text-[13px] text-stone-gray font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {rawOutput}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
