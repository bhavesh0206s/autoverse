// ── Generic API envelope ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ── Browser Events ────────────────────────────────────────────────────────────

export type EventType = "click" | "input" | "navigation" | "scroll" | "keydown" | (string & {});

export interface CapturedEvent {
  type: EventType;
  timestamp: number;
  url?: string;
  selector?: string | null;
  value?: string | null;
  text?: string | null;
  tagName?: string | null;
  scrollY?: number | null;
  direction?: string | null;
  fromUrl?: string | null;
  toUrl?: string | null;
  title?: string | null;
  sequence?: number;
  time_delta_ms?: number;
  [key: string]: unknown;
}

// ── Session ───────────────────────────────────────────────────────────────────

export type SessionStatus = "recording" | "processing" | "completed" | "failed";

export interface Session {
  id: string;
  goal: string;
  status: SessionStatus;
  event_count: number;
  page_title: string | null;
  start_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export interface WorkflowParameter {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  default: unknown;
  required: boolean;
}

export interface WorkflowStep {
  step: number;
  name: string;
  description: string;
  selector?: string;
}

export interface ActionStep {
  action: string;
  selector?: string;
  url?: string;
  value?: string;
  label?: string;
  attribute?: string;
  optional?: boolean;
  repeat_to?: number;
}

export interface ActionPlan {
  steps: ActionStep[];
  parameters: WorkflowParameter[];
}

export interface Workflow {
  id: string;
  session_id: string | null;
  name: string;
  description: string | null;
  parameters: WorkflowParameter[];
  steps: WorkflowStep[];
  action_plan: ActionPlan;
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  recent_runs?: RunLog[];
}

// ── Run Log ───────────────────────────────────────────────────────────────────

export type RunStatus = "running" | "success" | "failed" | "timeout";

export interface RunLog {
  id: string;
  workflow_id: string;
  parameters_used: Record<string, unknown>;
  status: RunStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  screenshot_path: string | null;
  ran_at: string;
}
