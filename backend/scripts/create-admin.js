// Creates a VibeYetu staff account.
// Run in the backend folder:   node scripts/create-admin.js you@example.com "Your Full Name"
// It then asks for a password (at least 12 characters). The password is not shown while you type.
import readline from 'node:readline';
import { createAdmin } from '../src/services/admin.service.js';
import { pool } from '../src/config/db.js';

const [email, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(' ');
if (!email || !fullName) {
  console.error('Usage: node scripts/create-admin.js you@example.com "Your Full Name"');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (text) => {
      if (!muted) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

try {
  const password = await askHidden('Password (at least 12 characters, hidden): ');
  const again = await askHidden('Type it again: ');
  if (password !== again) throw new Error('The two passwords are not the same. Nothing was created.');
  const admin = await createAdmin({ email, fullName, password });
  console.log(`Staff account created for ${admin.email}. You can now sign in as admin.`);
} catch (err) {
  console.error(`Could not create the account: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
