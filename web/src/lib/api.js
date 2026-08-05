const API_BASE = "http://localhost:4000/api";

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getMenu: () => request("/menu"),
  getOrders: (studentName) =>
    request(`/orders?student_name=${encodeURIComponent(studentName)}`),
  getAllOrders: () => request("/orders"),
  createOrder: (studentName, items) =>
    request("/orders", {
      method: "POST",
      body: JSON.stringify({ student_name: studentName, items }),
    }),
  updateOrderStatus: (orderId, status) =>
    request(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
