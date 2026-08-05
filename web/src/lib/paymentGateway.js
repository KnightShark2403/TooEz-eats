// STUB payment gateway. No payment SDK/keys exist in this repo yet, so this
// mimics the shape a real client (Stripe, Razorpay, etc.) would have —
// charge({ amountRupees }) returns a promise resolving to { success,
// paymentId }. Swap the body for a real SDK call later; call sites don't
// need to change.
export async function charge({ amountRupees }) {
  await new Promise((resolve) => setTimeout(resolve, 1400));
  return { success: true, paymentId: `STUB-${Date.now()}`, amountRupees };
}
