/**
 * Artifact-domain object shapes: the per-artifact module-progress store.
 */

export interface ModuleProgress {
  completed: ReadonlySet<string>;
  isComplete: (moduleId: string) => boolean;
  toggle: (moduleId: string) => void;
  setComplete: (moduleId: string, done: boolean) => void;
  reset: () => void;
  progressRatio: (total: number) => number;
}
