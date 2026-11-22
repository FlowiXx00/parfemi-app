import {
  buildSavePayload,
  normalizePerfumeRow,
} from "../lib/perfumes.lib";
import type {
  Accord,
  EditorState,
  Notes,
  PerfumeAdminRow,
  Wear,
} from "../types";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";

const API_BASE = "/api/admin/perfumes";

export class AdminPerfumesApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminPerfumesApiError";
    this.status = status;
  }
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

export type SaveResult = {
  id: string;
  /** How many external images were just copied to our Storage */
  storedImages: number;
  /** Images that couldn't be copied (the original link is kept) */
  warnings: string[];
};

export async function saveAdminPerfume(editor: EditorState): Promise<SaveResult> {
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

  const body = (data && typeof data === "object" ? data : {}) as {
    id?: unknown;
    storedImages?: unknown;
    warnings?: unknown;
  };

  return {
    id: typeof body.id === "string" && body.id.trim() ? body.id.trim() : payload.id,
    storedImages: typeof body.storedImages === "number" ? body.storedImages : 0,
    warnings: Array.isArray(body.warnings)
      ? body.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };
}

/** Image from the computer -> our Storage; returns the public image URL. */
export async function uploadPerfumeImage(file: File, perfumeId: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("perfumeId", perfumeId);

  const response = await fetch(`${API_BASE}/upload-image`, { method: "POST", body: form });
  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminPerfumesApiError(response.status, resolveErrorMessage(data, "Slanje slike nije uspelo."));
  }

  const url = data && typeof data === "object" && "url" in data ? data.url : null;
  if (typeof url !== "string" || !url) {
    throw new AdminPerfumesApiError(500, "Server nije vratio link slike.");
  }
  return url;
}

export type ScentResult = { notes: Notes; accords: Accord[]; wear: Wear };
export type ScentImagePayload = { mediaType: string; data: string };

/** Whether "Fill from image" (AI) is enabled on this site. */
export async function fetchScentAiEnabled(): Promise<boolean> {
  const response = await fetch(`${API_BASE}/scent-from-image`, { cache: "no-store" });
  if (!response.ok) return false;
  const data = await readJsonSafe(response);
  return Boolean(data && typeof data === "object" && "enabled" in data && data.enabled);
}

/** AI reads screenshots of notes / accords / when to wear. */
export async function readScentFromImages(images: ScentImagePayload[], name: string): Promise<ScentResult> {
  const response = await fetch(`${API_BASE}/scent-from-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images, name }),
  });
  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminPerfumesApiError(response.status, resolveErrorMessage(data, "AI čitanje nije uspelo."));
  }

  const result = data && typeof data === "object" && "result" in data ? data.result : null;
  if (!result || typeof result !== "object") {
    throw new AdminPerfumesApiError(500, "AI nije vratio podatke.");
  }
  return result as ScentResult;
}

/** Revalidates the shop cache (after changes made outside the admin, e.g. directly in the database). */
export async function revalidateShop(): Promise<void> {
  const response = await fetch("/api/admin/revalidate", {
    method: "POST",
  });

  if (!response.ok) {
    const data = await readJsonSafe(response);
    throw new AdminPerfumesApiError(
      response.status,
      resolveErrorMessage(data, "Greška pri osvežavanju shopa.")
    );
  }
}

/** Stock: set = exactly this many ml, add = top up (+ml), off = don't track. Returns the new value (null = not tracked). */
export async function setAdminStock(id: string, mode: "set" | "add" | "off", ml?: number): Promise<number | null> {
  const response = await fetch(`${API_BASE}/stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, mode, ml }),
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new AdminPerfumesApiError(response.status, resolveErrorMessage(data, "Čuvanje zaliha nije uspelo."));
  }
  const stockMl = data && typeof data === "object" && "stockMl" in data ? data.stockMl : null;
  return typeof stockMl === "number" ? stockMl : null;
}

/** Quick rating entry: only the Fragrantica rating + vote count (null = clear). */
export async function saveAdminRating(id: string, rating: number | null, votes: number | null): Promise<void> {
  const response = await fetch(`${API_BASE}/rating`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, rating, votes }),
  });

  if (!response.ok) {
    const data = await readJsonSafe(response);
    throw new AdminPerfumesApiError(response.status, resolveErrorMessage(data, "Čuvanje ocene nije uspelo."));
  }
}

/** Hide a perfume from the shop / bring it back (nothing is deleted). */
export async function setAdminPerfumeActive(id: string, active: boolean): Promise<void> {
  const response = await fetch(`${API_BASE}/visibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, active }),
  });

  if (!response.ok) {
    const data = await readJsonSafe(response);
    throw new AdminPerfumesApiError(
      response.status,
      resolveErrorMessage(data, "Promena vidljivosti nije uspela.")
    );
  }
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