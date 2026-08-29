import { type Response } from 'express';

import { type PaginationMeta, type PaginationQuery } from '@/contract/index.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface ResolvedPagination {
  page: number;
  pageSize: number;

  offset: number;

  limit: number;
}

export function resolvePagination(query: PaginationQuery): ResolvedPagination {
  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

export function buildMeta(resolved: ResolvedPagination, total: number): PaginationMeta {
  return {
    page: resolved.page,
    pageSize: resolved.pageSize,
    total,
    hasMore: resolved.offset + resolved.pageSize < total,
  };
}

const META_KEY = '__paginationMeta';

export function attachPaginationMeta(res: Response, meta: PaginationMeta): void {
  (res.locals as Record<string, unknown>)[META_KEY] = meta;
}

export function readPaginationMeta(res: Response): PaginationMeta | undefined {
  return (res.locals as Record<string, unknown>)[META_KEY] as PaginationMeta | undefined;
}
