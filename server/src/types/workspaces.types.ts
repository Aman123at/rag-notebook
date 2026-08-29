import type { Workspace } from '@/contract/index.js';

export interface ListWorkspacesResult {
  items: Workspace[];
  total: number;
}
