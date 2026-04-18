import {
  buildSavePayload,
  normalizePerfumeRow,
} from "../lib/perfumes.lib";
import type {
  EditorState,
  PerfumeAdminRow,
} from "../types";

const API_BASE = "/api/admin/perfumes";

export class AdminPerfumesApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminPerfumesApiError";
    this.status = status;
  }
}

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resolveErrorMessage(data: unknown, fallback: string) {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }

  return fallback;
}

export async function fetchAdminPerfumes(): Promise<PerfumeAdminRow[]> {
  const response = await fetch(`${API_BASE}/list`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminPerfumesApiError(
      response.status,
      resolveErrorMessage(data, "Greška pri učitavanju parfema.")
    );
  }

  const perfumes: unknown[] =
    data &&
    typeof data === "object" &&
    "perfumes" in data &&
    Array.isArray(data.perfumes)
      ? data.perfumes
      : [];

  return perfumes
    .map((item: unknown) => normalizePerfumeRow(item))
    .filter((item): item is PerfumeAdminRow => Boolean(item));
}

export async function saveAdminPerfume(editor: EditorState): Promise<string> {
  const payload = buildSavePayload(editor);

  const response = await fetch(`${API_BASE}/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminPerfumesApiError(
      response.status,
      resolveErrorMessage(data, "Greška pri čuvanju.")
    );
  }

  if (
    data &&
    typeof data === "object" &&
    "id" in data &&
    typeof data.id === "string" &&
    data.id.trim()
  ) {
    return data.id.trim();
  }

  return payload.id;
}

export async function deleteAdminPerfume(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/delete?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminPerfumesApiError(
      response.status,
      resolveErrorMessage(data, "Greška pri brisanju.")
    );
  }
}