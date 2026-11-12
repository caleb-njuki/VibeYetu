// Takes the buyer's money. For now it is SIMULATED: every payment succeeds and no real money moves.
// When M-Pesa (Daraja) is confirmed, only this file changes: it will send the STK Push and wait for the result.
export const PAYMENT_PROVIDER = 'simulated';

export async function chargeBuyer({ method, phone, amount, groupId }) {
  void method; void phone; void amount; void groupId;
  return { ok: true, provider: PAYMENT_PROVIDER };
}

// Sellers pay for ads, and are refunded when an ad cannot run. Simulated like the buyer payment above.
export async function chargeAdvertiser({ amount, shopId }) {
  void amount; void shopId;
  return { ok: true, provider: PAYMENT_PROVIDER };
}

export async function refundAdvertiser({ amount, shopId }) {
  void amount; void shopId;
  return { ok: true, provider: PAYMENT_PROVIDER };
}
