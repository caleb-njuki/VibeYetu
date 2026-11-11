// Takes the buyer's money. For now it is SIMULATED: every payment succeeds and no real money moves.
// When M-Pesa (Daraja) is confirmed, only this file changes: it will send the STK Push and wait for the result.
export const PAYMENT_PROVIDER = 'simulated';

export async function chargeBuyer({ method, phone, amount, groupId }) {
  void method; void phone; void amount; void groupId;
  return { ok: true, provider: PAYMENT_PROVIDER };
}
