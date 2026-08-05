import { useState } from "react";
import { api } from "./api.js";
import { getToken } from "./auth.js";
import { usePolling } from "./usePolling.js";

const POLL_MS = 4000;

// Polls all of the current student's active (non-Completed) orders, so
// every order placed stays independently trackable — never overwritten by
// the next one. Most recent first (matches the API's ordering).
export function useActiveOrders() {
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = getToken();

  usePolling(
    () => {
      if (!token) {
        setLoading(false);
        return Promise.resolve();
      }
      return api
        .getMyOrders()
        .then((orders) => {
          setActiveOrders(orders.filter((o) => o.status !== "Completed"));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    POLL_MS,
    [token]
  );

  return { activeOrders, loading };
}
