import type { z } from 'zod';

import { type ErrorCode } from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type AuthRequirement = 'required' | 'public' | 'webhook';
export type ContentType = 'application/json' | 'text/event-stream';









export interface RouteDefinition<
  M extends HttpMethod = HttpMethod,
  P extends string = string,
  A extends AuthRequirement = AuthRequirement,
  Params extends z.ZodType = z.ZodType,
  Query extends z.ZodType = z.ZodType,
  Body extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> {
  
  method: M;
  
  path: P;
  
  auth: A;
  
  params: Params;
  
  query: Query;
  
  body: Body;
  
  response: Response;
  
  errors: readonly ErrorCode[];
  
  summary?: string;
  
  description?: string;
  
  tags?: readonly string[];
  





  responseContentType?: ContentType;
  
  successStatus?: number;
}







export function defineRouteDefinition<
  M extends HttpMethod,
  P extends string,
  A extends AuthRequirement,
  Params extends z.ZodType,
  Query extends z.ZodType,
  Body extends z.ZodType,
  Response extends z.ZodType,
>(
  def: RouteDefinition<M, P, A, Params, Query, Body, Response>,
): RouteDefinition<M, P, A, Params, Query, Body, Response> {
  return def;
}


export type InferParams<R extends RouteDefinition> = z.infer<R['params']>;

export type InferQuery<R extends RouteDefinition> = z.infer<R['query']>;

export type InferBody<R extends RouteDefinition> = z.infer<R['body']>;

export type InferResponse<R extends RouteDefinition> = z.infer<R['response']>;
