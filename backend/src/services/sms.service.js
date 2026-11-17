// Not used any more: every one-time code now goes by email (see email.service.js).
// This file is kept only so old imports do not break. It sends nothing.
export async function sendSms() {
  throw new Error('SMS is not used. Codes are sent by email.');
}
