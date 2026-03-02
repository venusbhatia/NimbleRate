import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error: unknown) {
        if (error instanceof Error && "status" in error) {
          const status = Number((error as { status?: number }).status);
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000)
    }
  }
});

function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-8 text-dune-950">
      <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-card">
        <p className="text-sm font-semibold text-red-700">Dashboard crashed</p>
        <p className="mt-2 text-sm text-dune-700">
          Refresh and retry. Check API keys in <code>.env.local</code> if this repeats.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
