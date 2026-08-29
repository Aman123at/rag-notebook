import * as React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiContext } from "./api-mock";
import type { Api } from "@/lib/api/client";

interface Options extends Omit<RenderOptions, "wrapper"> {
  api: Api;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { api, queryClient, ...rest }: Options,
) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ApiContext.Provider value={api}>
          <TooltipProvider>{children}</TooltipProvider>
        </ApiContext.Provider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...rest }), queryClient: client };
}
