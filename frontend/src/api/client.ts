import axios from "axios";
import type { ApiResponse, Session, Workflow, RunLog } from "@/types";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 60_000,
});

// Unwrap error messages uniformly
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message: string =
      err.response?.data?.error ?? err.response?.data?.detail ?? err.message ?? "Network error";
    return Promise.reject(new Error(message));
  }
);

// ── Generic typed helpers ──────────────────────────────────────────────────────

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await client.get<ApiResponse<T>>(url, { params });
  return res.data.data as T;
}

async function post<T>(url: string, data?: unknown): Promise<T> {
  const res = await client.post<ApiResponse<T>>(url, data);
  return res.data.data as T;
}

async function patch<T>(url: string, data?: unknown): Promise<T> {
  const res = await client.patch<ApiResponse<T>>(url, data);
  return res.data.data as T;
}

async function del(url: string): Promise<void> {
  await client.delete(url);
}

// ── Domain API functions ───────────────────────────────────────────────────────

export const api = {
  // Sessions
  createSession: (goal: string, startUrl?: string, pageTitle?: string) =>
    post<Session>("/api/sessions", { goal, start_url: startUrl, page_title: pageTitle }),

  getSessions: (limit = 20) => get<Session[]>("/api/sessions", { limit }),

  getSession: (id: string) => get<Session>(`/api/sessions/${id}`),

  updateSessionStatus: (id: string, status: string) =>
    patch<Session>(`/api/sessions/${id}/status`, { status }),

  // Learn (LLM generation)
  triggerLearn: (sessionId: string) => post<Workflow>(`/api/sessions/${sessionId}/learn`),

  // Workflows
  getWorkflows: (search?: string, limit = 20) =>
    get<Workflow[]>("/api/workflows", { search, limit }),

  getWorkflow: (id: string) => get<Workflow>(`/api/workflows/${id}`),

  updateWorkflow: (id: string, data: Partial<Workflow>) =>
    patch<Workflow>(`/api/workflows/${id}`, data),

  deleteWorkflow: (id: string) => del(`/api/workflows/${id}`),

  // Runner
  runWorkflow: (id: string, parameters: Record<string, unknown> = {}) =>
    post<RunLog>(`/api/workflows/${id}/run`, { parameters }),

  getWorkflowRuns: (workflowId: string, limit = 10) =>
    get<RunLog[]>(`/api/workflows/${workflowId}/runs`, { limit }),

  getRun: (id: string) => get<RunLog>(`/api/runs/${id}`),
};

export default client;
