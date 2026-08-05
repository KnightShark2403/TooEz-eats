import { getToken } from "./auth.js";

const API_BASE = "http://localhost:4000/api";

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getMenu: () => request("/menu"),
  getMyOrders: () => request("/orders/mine"),
  getAllOrders: () => request("/orders"),
  createOrder: (items) =>
    request("/orders", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  updateOrderStatus: (orderId, status) =>
    request(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  signup: ({ role, email, password, name }) =>
    request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ role, email, password, name }),
    }),
  login: ({ role, email, password }) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ role, email, password }),
    }),
};
