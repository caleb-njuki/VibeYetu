// Sends a real email from a Gmail account (EMAIL_USER + EMAIL_APP_PASSWORD) using the nodemailer package.
// Nothing is ever printed in the terminal instead of being sent.
// (EMAIL_MODE=test exists only for the automatic test scripts, with NODE_ENV=test. It keeps the emails in memory.)
import { config } from '../config/env.js';

function emailError() {
  const err = new Error('Could not send the email. Please check the address and try again.');
  err.status = 502;
  return err;
}

let transport;
export const testOutbox = [];

export async function sendEmail(to, subject, text) {
  if (config.email.mode === 'test') {
    testOutbox.push({ to, subject, text });
    return;
  }
  try {
    if (!transport) {
      const { default: nodemailer } = await import('nodemailer');
      transport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.email.user, pass: config.email.appPassword },
      });
    }
    await transport.sendMail({ from: `"${config.email.fromName}" <${config.email.user}>`, to, subject, text });
  } catch (err) {
    console.error('Email could not be sent:', err.message);
    transport = undefined; // build a fresh connection next time
    throw emailError();
  }
}
