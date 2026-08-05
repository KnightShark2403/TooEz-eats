import { useState } from "react";
import { api } from "./api.js";
import { getStudentName } from "./student.js";
import { usePolling } from "./usePolling.js";

const POLL_MS = 4000;

// Polls the current student's most recent non-completed order so the menu
// screen's live-order card stays in sync without a manual refresh.
export function useActiveOrder() {
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const name = getStudentName();

  usePolling(
    () => {
      if (!name) {
        setLoading(false);
        return Promise.resolve();
      }
      return api
        .getOrders(name)
        .then((orders) => {
          const active = orders.find((o) => o.status !== "Completed") || null;
          setActiveOrder(active);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    POLL_MS,
    [name]
  );

  return { activeOrder, loading };
}
