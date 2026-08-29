"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createApi, type Api } from "@/lib/api/client";

export const ApiContext = createContext<Api | null>(null);

/**
 * Client-side API provider. Resolves the current Clerk session token on each request
 * via `useAuth().getToken()`. Server components must not consume this — they should
 * construct their own client with the request-scoped `auth()` token from Clerk.
 */
export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  const api = useMemo(
    () => createApi(async () => (await getToken()) ?? null),
    [getToken],
  );

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (api === null) {
    throw new Error("useApi must be used inside <ApiProvider>");
  }
  return api;
}
