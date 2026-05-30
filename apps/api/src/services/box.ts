// Dependency-free Box wrapper using a developer token + the Box REST API.
// Keeps the MVP off the heavier OAuth/JWT SDK path. Every call is best-effort:
// callers are expected to catch and degrade gracefully (plan §"Box fallback").

const API_BASE = "https://api.box.com/2.0";
const UPLOAD_BASE = "https://upload.box.com/api/2.0";

/** Box "All Files" root. Used when BOX_ROOT_FOLDER_ID is not configured. */
const ROOT_FALLBACK = "0";

export type BoxFile = { id: string; url: string };
export type BoxFolder = { id: string; url: string };

/** True when a developer token is available to talk to Box. */
export function boxConfigured(): boolean {
  return !!process.env.BOX_DEVELOPER_TOKEN;
}

/** Parent folder for new projects (configured root, else Box "All Files"). */
export function boxRootFolderId(): string {
  return process.env.BOX_ROOT_FOLDER_ID || ROOT_FALLBACK;
}

export const folderUrl = (id: string): string => `https://app.box.com/folder/${id}`;
export const fileUrl = (id: string): string => `https://app.box.com/file/${id}`;

function authHeader(): Record<string, string> {
  const token = process.env.BOX_DEVELOPER_TOKEN;
  if (!token) throw new Error("BOX_DEVELOPER_TOKEN is not set");
  return { Authorization: `Bearer ${token}` };
}

/** Extract the id of a pre-existing item from a Box 409 conflict response. */
function conflictId(body: unknown): string | undefined {
  const conflicts = (body as { context_info?: { conflicts?: unknown } })?.context_info?.conflicts;
  const first = Array.isArray(conflicts) ? conflicts[0] : conflicts;
  const id = (first as { id?: unknown })?.id;
  return typeof id === "string" ? id : undefined;
}

/**
 * Create a folder under `parentId`. If a folder with that name already exists,
 * reuse it (Box returns 409 with the existing id) so the operation is idempotent.
 */
export async function createFolder(name: string, parentId: string): Promise<BoxFolder> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent: { id: parentId } }),
  });

  if (res.ok) {
    const json = (await res.json()) as { id: string };
    return { id: json.id, url: folderUrl(json.id) };
  }

  if (res.status === 409) {
    const existing = conflictId(await res.json().catch(() => null));
    if (existing) return { id: existing, url: folderUrl(existing) };
  }

  throw new Error(`Box createFolder("${name}") failed: ${res.status} ${await res.text()}`);
}

/**
 * Upload a JSON artifact into `parentId`. If a file of the same name exists,
 * upload a new version of it instead of failing.
 */
export async function uploadJson(
  name: string,
  data: unknown,
  parentId: string
): Promise<BoxFile> {
  const content = JSON.stringify(data, null, 2);
  return uploadText(name, content, parentId, "application/json");
}

export async function uploadText(
  name: string,
  content: string,
  parentId: string,
  contentType = "text/plain"
): Promise<BoxFile> {
  const blob = new Blob([content], { type: contentType });

  const form = new FormData();
  form.append("attributes", JSON.stringify({ name, parent: { id: parentId } }));
  form.append("file", blob, name);

  const res = await fetch(`${UPLOAD_BASE}/files/content`, {
    method: "POST",
    headers: authHeader(), // let fetch set the multipart boundary
    body: form,
  });

  if (res.ok) {
    const json = (await res.json()) as { entries: { id: string }[] };
    const id = json.entries[0]!.id;
    return { id, url: fileUrl(id) };
  }

  // Name already taken → upload a new version of the existing file.
  if (res.status === 409) {
    const existing = conflictId(await res.json().catch(() => null));
    if (existing) {
      const versionForm = new FormData();
      versionForm.append("attributes", JSON.stringify({ name }));
      versionForm.append("file", blob, name);
      const vres = await fetch(`${UPLOAD_BASE}/files/${existing}/content`, {
        method: "POST",
        headers: authHeader(),
        body: versionForm,
      });
      if (vres.ok) return { id: existing, url: fileUrl(existing) };
    }
  }

  throw new Error(`Box uploadText("${name}") failed: ${res.status} ${await res.text()}`);
}
