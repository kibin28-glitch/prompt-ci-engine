import { randomUUID } from "node:crypto";
import type { RunResult } from "../types.js";

const DEFAULT_DASHBOARD_URL = "http://localhost:3000";

export function getDashboardUrl(): string {
  const url = process.env.PROMPTCI_DASHBOARD_URL?.trim();
  return url && url.length > 0 ? url.replace(/\/+$/, "") : DEFAULT_DASHBOARD_URL;
}

export function getToken(): string {
  const existing = process.env.PROMPTCI_TOKEN?.trim();
  if (existing && existing.length > 0) {
    return existing;
  }
  const generated = randomUUID();
  console.log(`No PROMPTCI_TOKEN set; generated a temporary token: ${generated}`);
  console.log(`Set PROMPTCI_TOKEN=${generated} in your environment for consistent rate-limit tracking.`);
  return generated;
}

export interface UploadResponse {
  runId: string;
  url: string;
}

export async function uploadResult(results: RunResult[]): Promise<UploadResponse> {
  const dashboardUrl = getDashboardUrl();
  const token = getToken();

  const response = await fetch(`${dashboardUrl}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, payload: results }),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { runId?: string };
  if (!data.runId) {
    throw new Error("Upload response did not include a runId");
  }

  return { runId: data.runId, url: `${dashboardUrl}/r/${data.runId}` };
}
