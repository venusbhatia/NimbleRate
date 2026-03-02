export function AppErrorFallback() {
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
