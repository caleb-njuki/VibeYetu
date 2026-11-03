// Sends an SMS.
// Development: prints the message in the terminal (no SMS is sent).
// Production: sends through Africa's Talking.
import { config } from '../config/env.js';

function smsError() {
  const err = new Error('Could not send the SMS. Please try again.');
  err.status = 502;
  return err;
}

export async function sendSms(phone, message) {
  if (!config.isProduction) {
    console.log(`\n[DEV SMS] To ${phone}: ${message}\n`);
    return;
  }

  const { username, apiKey } = config.africasTalking;
  const baseUrl =
    username === 'sandbox'
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com';

  let response;
  try {
    response = await fetch(`${baseUrl}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ username, to: phone, message }).toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error("Africa's Talking request failed:", err.message);
    throw smsError();
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Not JSON: treated as a failure below.
  }

  // Africa's Talking status codes: 100 processed, 101 sent, 102 queued.
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (!response.ok || ![100, 101, 102].includes(recipient?.statusCode)) {
    console.error(
      "Africa's Talking did not accept the SMS. HTTP status:",
      response.status,
      '| result:',
      recipient?.status ?? 'no recipient result'
    );
    throw smsError();
  }
}
