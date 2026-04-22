import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Play, History, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/api/client";
import type { Workflow, RunLog, WorkflowParameter, WorkflowStep } from "@/types";
import clsx from "clsx";

type Tab = "plan" | "history";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-12 p-10 max-w-[1560px] mx-auto">
      <div className="space-y-4">
        <div className="h-12 bg-earth-gray rounded-tight w-1/3" />
        <div className="h-6 bg-earth-gray rounded-tight w-1/2" />
      </div>
      <div className="grid grid-cols-5 gap-12">
        <div className="col-span-3 h-96 bg-earth-gray rounded-comfortable" />
        <div className="col-span-2 h-96 bg-earth-gray rounded-comfortable" />
      </div>
    </div>
  );
}

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("plan");
  const [params, setParams] = useState<Record<string, string>>({});
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const {
    data: workflow,
    isLoading,
    error,
  } = useQuery<Workflow>({
    queryKey: ["workflow", id],
    queryFn: () => api.getWorkflow(id!),
    enabled: !!id,
  });

  const { data: runs = [] } = useQuery<RunLog[]>({
    queryKey: ["runs", id],
    queryFn: () => api.getWorkflowRuns(id!),
    enabled: !!id && tab === "history",
    refetchInterval: 5000,
  });

  const runMutation = useMutation({
    mutationFn: (vars: Record<string, string>) => api.runWorkflow(id!, vars),
    onSuccess: (run) => {
      toast.success("Execution started");
      qc.invalidateQueries({ queryKey: ["runs", id] });
      navigate(`/run/${run.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton />;
  if (error || !workflow)
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center p-8">
        <h1 className="text-[40px] font-sans font-normal text-parchment mb-4">
          Workflows not found.
        </h1>
        <Link
          to="/"
          className="text-ash-gray hover:text-parchment underline underline-offset-8 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );

  let parameters = workflow.parameters as WorkflowParameter[] | Record<string, WorkflowParameter>;
  const steps = workflow.steps as WorkflowStep[];

  let mergedParams: Record<string, string> = {};
  if (parameters instanceof Array) {
    mergedParams = parameters?.reduce<Record<string, string>>((acc, p) => {
      acc[p.name] = params[p.name] ?? (p.default != null ? String(p.default) : "");
      return acc;
    }, {});
  } else {
    mergedParams = Object.keys(parameters)?.reduce<Record<string, string>>((acc, p) => {
      acc[p] = params[p] ?? (parameters[p].default != null ? String(parameters[p].default) : "");
      return acc;
    }, {});
    parameters = Object.keys(parameters).map((p) => ({
      name: p,
      required: p !== "headless",
      ...parameters?.[p],
    }));
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-[14px] font-medium text-stone-gray hover:text-parchment transition-colors"
        >
          <ChevronLeft size={16} />{" "}
          <span className="uppercase tracking-editorial text-[11px] font-bold mt-0.5">
            Back to Workflows
          </span>
        </button>

        <div className="flex items-center gap-12">
          <div className="flex items-center gap-6 text-[12px] font-bold text-stone-gray uppercase tracking-editorial">
            <span>Draft v1.0</span>
            <span>
              Last edited{" "}
              {formatDistanceToNow(new Date(workflow.updated_at || workflow.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
        <div className="lg:col-span-3 space-y-12">
          <div className="space-y-8">
            <h1 className="text-[56px] font-sans font-normal text-parchment leading-tight tracking-[-1.12px]">
              {workflow.name}
            </h1>
            {workflow.description && (
              <p className="text-[20px] text-ash-gray leading-relaxed max-w-2xl">
                {workflow.description}
              </p>
            )}
          </div>

          <div className="h-px bg-mist" />

          <div className="space-y-12">
            {steps.length > 0 && (
              <div className="space-y-8">
                <h3 className="text-[12px] font-bold text-stone-gray uppercase tracking-editorial">
                  Operational Flow
                </h3>
                <div className="space-y-0 relative">
                  {steps.map((s, i) => (
                    <div key={i} className="flex gap-8 group">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-tight bg-earth-gray border border-mist flex items-center justify-center flex-shrink-0 z-10">
                          <span className="text-[10px] font-bold text-ash-gray">{i + 1}</span>
                        </div>
                        {i < steps.length - 1 && <div className="w-px h-full bg-mist -my-1" />}
                      </div>
                      <div className="pb-6 pt-0.5">
                        <p className="text-[18px] font-medium text-parchment group-hover:text-ash-gray transition-colors">
                          {typeof s === "string" ? s : s.name}
                        </p>
                        {s.description && (
                          <p className="text-[14px] text-stone-gray mt-2 leading-relaxed">
                            {s.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parameters.length > 0 && (
              <div className="space-y-8">
                <h3 className="text-[12px] font-bold text-stone-gray uppercase tracking-editorial">
                  Execution Parameters
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {parameters.map((p) => (
                    <div key={p.name} className="space-y-3">
                      <label className="flex items-center justify-between text-[11px] font-bold text-stone-gray uppercase tracking-editorial">
                        <span>{p.name}</span>
                        {p.required && <span className="text-stone-gray/50">Required</span>}
                      </label>
                      <input
                        type={p.type === "number" ? "number" : "text"}
                        className="w-full bg-earth-gray/30 border border-mist hover:border-ash-gray/30 focus:border-parchment/50 rounded-standard px-5 py-3.5 text-parchment text-[16px] transition-all outline-none"
                        placeholder={p.description || "Enter value..."}
                        value={mergedParams[p.name] ?? ""}
                        onChange={(e) =>
                          setParams((prev) => ({ ...prev, [p.name]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => runMutation.mutate(mergedParams)}
              disabled={runMutation.isPending}
              className="px-10 py-5 bg-parchment text-void rounded-pill font-bold text-[18px] hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-3 w-fit"
            >
              <Play size={20} className="fill-current" />
              {runMutation.isPending ? "Executing..." : "Invoke Workflow"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8 sticky top-32">
          <div className="flex border-b border-mist">
            {(["plan", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "px-8 py-4 text-[12px] font-bold uppercase tracking-editorial relative transition-all",
                  tab === t ? "text-parchment" : "text-stone-gray hover:text-ash-gray"
                )}
              >
                {t}
                {tab === t && (
                  <div className="absolute bottom-[-1px] left-8 right-8 h-px bg-parchment" />
                )}
              </button>
            ))}
          </div>

          <div className="min-h-[500px]">
            {tab === "plan" ? (
              <div className="bg-earth-gray/20 border border-mist rounded-comfortable overflow-hidden">
                <div className="bg-earth-gray/40 border-b border-mist px-6 py-3 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-mist" />
                    <div className="w-2.5 h-2.5 rounded-full bg-mist" />
                    <div className="w-2.5 h-2.5 rounded-full bg-mist" />
                  </div>
                </div>
                <pre className="text-[14px] text-ash-gray font-mono p-8 overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap leading-relaxed selection:bg-parchment/20">
                  {JSON.stringify(workflow.action_plan, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="space-y-4">
                {runs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                    <History size={40} className="mb-4 text-stone-gray" />
                    <p className="text-[14px] font-medium text-stone-gray">
                      No execution history for this node.
                    </p>
                  </div>
                )}
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="bg-earth-gray/20 border border-mist rounded-comfortable overflow-hidden group"
                  >
                    <button
                      onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                      className="w-full flex items-center gap-4 p-6 text-left hover:bg-earth-gray/40 transition-all"
                    >
                      <div
                        className={clsx(
                          "w-2 h-2 rounded-full",
                          run.status === "success"
                            ? "bg-ash-gray"
                            : run.status === "failed"
                              ? "bg-red-500/60"
                              : "bg-stone-gray"
                        )}
                      />
                      <div className="flex-1">
                        <span className="text-[14px] font-medium text-parchment capitalize">
                          {run.status}
                        </span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] font-bold text-stone-gray uppercase tracking-editorial">
                            {formatDistanceToNow(new Date(run.ran_at), { addSuffix: true })}
                          </span>
                          {run.duration_ms && (
                            <span className="text-[11px] font-medium text-stone-gray/50 whitespace-nowrap">
                              · {(run.duration_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className={clsx(
                          "text-stone-gray transition-transform",
                          expandedRun === run.id ? "rotate-90" : ""
                        )}
                      />
                    </button>
                    {expandedRun === run.id && (
                      <div className="px-6 pb-6 pt-2 border-t border-mist/30">
                        {run.error && (
                          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-tight mb-4 mt-2">
                            <p className="text-[13px] text-red-400 font-mono leading-relaxed">
                              {run.error}
                            </p>
                          </div>
                        )}
                        {run.result && (
                          <pre className="text-[12px] text-ash-gray font-mono bg-void/50 border border-mist rounded-tight p-4 overflow-x-auto max-h-48 mt-2">
                            {JSON.stringify(run.result, null, 2)}
                          </pre>
                        )}
                        <Link
                          to={`/run/${run.id}`}
                          className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold text-parchment uppercase tracking-editorial hover:underline underline-offset-4"
                        >
                          Analysis Details <ChevronRight size={12} />
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
