/**
 * Workspace-domain type aliases.
 */
import type { GetResult, PostResult } from "@/lib/api/types";

export type Workspace = GetResult<"/workspaces">[number];
export type WorkspaceCreated = PostResult<"/workspaces">;
