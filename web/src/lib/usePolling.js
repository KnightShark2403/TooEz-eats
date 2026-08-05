import { useEffect, useRef } from "react";

// Calls fetcher immediately, then every intervalMs, until the component
// unmounts or a value in deps changes. Simplest realtime mechanism the
// stack supports — no websockets/SSE infra in this MVP.
export function usePolling(fetcher, intervalMs, deps = []) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) fetcherRef.current();
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
