import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Play, GitBranch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/api/client";
import type { Workflow } from "@/types";
import clsx from "clsx";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-earth-gray/20 border border-mist rounded-comfortable p-8 animate-pulse space-y-4">
      <div className="h-4 bg-earth-gray rounded w-3/4" />
      <div className="h-3 bg-earth-gray rounded w-full" />
      <div className="h-3 bg-earth-gray rounded w-1/2" />
    </div>
  );
}

// ── Workflow Card ─────────────────────────────────────────────────────────────
function WorkflowCard({ wf }: { wf: Workflow }) {
  const lastRun = wf.recent_runs?.[0];
  const statusColor = lastRun
    ? lastRun.status === "success"
      ? "bg-ash-gray"
      : "bg-stone-gray"
    : "bg-stone-gray";

  return (
    <div className="group bg-earth-gray/40 border border-mist hover:border-ash-gray/30 rounded-comfortable p-8 flex flex-col gap-6 transition-all duration-300">
      <Link to={`/workflow/${wf.id}`} className="flex-1 block space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-sans font-medium text-[24px] text-parchment leading-tight tracking-[-0.72px] group-hover:text-ash-gray transition-colors">
            {wf.name}
          </h3>
          <div className={clsx("w-2 h-2 rounded-full mt-2.5", statusColor)} />
        </div>
        {wf.description && (
          <p className="text-[18px] text-ash-gray leading-snug line-clamp-2">{wf.description}</p>
        )}
      </Link>

      <div className="flex items-center justify-between pt-4 border-t border-mist">
        <div className="flex items-center gap-6 text-[12px] font-medium text-stone-gray uppercase tracking-editorial">
          <span className="flex items-center gap-2">
            <Play size={10} className="fill-current" />
            {wf.run_count} runs
          </span>
          {wf.last_run_at && (
            <span>{formatDistanceToNow(new Date(wf.last_run_at), { addSuffix: true })}</span>
          )}
        </div>
        <Link
          to={`/workflow/${wf.id}`}
          className="text-[12px] font-bold text-parchment uppercase tracking-editorial opacity-0 group-hover:opacity-100 transition-opacity"
        >
          View details →
        </Link>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ["workflows"],
    queryFn: () => api.getWorkflows(),
    refetchInterval: 30_000,
  });

  const totalRuns = workflows.reduce((s, w) => s + (w.run_count ?? 0), 0);

  const stats = [
    { label: "Automations", value: workflows.length },
    { label: "Executions", value: totalRuns },
    { label: "Active Workflows", value: workflows.filter((w) => w.is_active).length },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
        <div className="max-w-3xl">
          <span className="text-[12px] font-bold text-stone-gray uppercase tracking-editorial block mb-2">
            Dashboard — Autoverse 1.0
          </span>
          <h1 className="text-[80px] font-sans font-normal text-parchment leading-[1.0] tracking-[-2.4px] mb-4">
            Your automations, <br /> in perfect flow.
          </h1>
          <p className="text-[20px] text-ash-gray leading-relaxed max-w-xl">
            A serene workspace for your AI-powered browser tasks. Build, monitor, and scale without
            the noise.
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-3">
          <div className="flex items-center gap-3 px-5 py-2.5 bg-earth-gray border border-mist rounded-pill">
            <div className="w-2 h-2 rounded-full bg-parchment animate-pulse" />
            <span className="text-[11px] font-bold text-parchment uppercase tracking-editorial">
              Extension Active
            </span>
          </div>
          <p className="text-[11px] text-stone-gray font-medium uppercase tracking-editorial">
            Open extension to record flows
          </p>
        </div>
      </div>

      {/* Stats Monochromatic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1px bg-mist border-y border-mist">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-void py-8 px-2 first:pl-0 last:pr-0">
            <span className="text-[11px] text-stone-gray font-bold uppercase tracking-editorial block mb-1">
              {label}
            </span>
            <p className="text-[48px] font-sans font-normal text-parchment tracking-tight">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Workflows section */}
      <div className="space-y-8">
        <div className="flex items-center justify-between border-b border-mist pb-4">
          <h2 className="text-[32px] font-sans font-normal text-parchment tracking-tight">
            Workflows
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-[12px] font-bold text-stone-gray uppercase tracking-editorial">
              {workflows.length} Total
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-mist border-dashed rounded-comfortable bg-earth-gray/10">
            <div className="w-20 h-20 rounded-pill bg-earth-gray flex items-center justify-center mb-8">
              <GitBranch size={32} className="text-stone-gray" />
            </div>
            <h3 className="text-[36px] font-sans font-normal text-parchment mb-4">
              No automations found
            </h3>
            <p className="text-[18px] text-ash-gray mb-10 max-w-md mx-auto">
              Start by recording your browser actions. Our AI will transform them into clean,
              reliable workflows.
            </p>
            <div className="px-10 py-4 bg-parchment text-void rounded-pill font-bold text-[16px] hover:brightness-90 transition-all cursor-pointer">
              Open Extension Context
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {workflows.map((wf) => (
              <WorkflowCard key={wf.id} wf={wf} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
