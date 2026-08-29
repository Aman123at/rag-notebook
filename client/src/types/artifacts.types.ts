/**
 * Artifact-domain type aliases.
 */
import type { GetResult } from "@/lib/api/types";

export type Artifact = GetResult<"/sources/{sourceId}/artifacts">[number];
export type ArtifactDetail = GetResult<"/artifacts/{artifactId}">;
