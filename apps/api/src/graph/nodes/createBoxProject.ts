import type { PipelineState, BoxProject } from "../state.js";
import { boxConfigured, boxRootFolderId, createFolder } from "../../services/box.js";

/** Subfolders created under every project workspace (plan §createBoxProject). */
const SUBFOLDERS = ["raw-evidence", "properties", "units", "reports", "judge-results"] as const;

function projectName(): string {
  // Box runtime (not a Workflow script) — Date is available here.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `AptLens ${stamp}`;
}

/**
 * Create the Box workspace for this run: a project folder plus standard
 * subfolders. Folder ids are stashed on state for uploadArtifactsToBox.
 *
 * Best-effort: if Box is unconfigured or any call fails, the pipeline continues
 * with `state.box = null` and an error recorded — it never throws (plan §Box fallback).
 */
export async function createBoxProject(state: PipelineState): Promise<PipelineState> {
  if (!boxConfigured()) {
    console.log("[createBoxProject] No BOX_DEVELOPER_TOKEN — skipping Box workspace");
    return state;
  }

  try {
    const project = await createFolder(projectName(), boxRootFolderId());
    console.log(`[createBoxProject] Created project folder ${project.id}`);

    const subfolders: Record<string, string> = {};
    for (const name of SUBFOLDERS) {
      const folder = await createFolder(name, project.id);
      subfolders[name] = folder.id;
    }

    const box: BoxProject = { projectFolderId: project.id, subfolders };
    return {
      ...state,
      box,
      artifacts: { ...state.artifacts, boxProjectUrl: project.url },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[createBoxProject] Box workspace creation failed: ${reason}`);
    return { ...state, errors: [...state.errors, `Box project creation failed: ${reason}`] };
  }
}
