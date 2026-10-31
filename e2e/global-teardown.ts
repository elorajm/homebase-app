import "dotenv/config";
import { Client } from "pg";
import { E2E_EMAIL_DOMAIN } from "./helpers";

// Removes accounts created by the end-to-end run. Sessions are removed by the database cascade.
export default async function globalTeardown() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`delete from "User" where email like $1`, [`%@${E2E_EMAIL_DOMAIN}`]);
    console.log(`[e2e] removed ${result.rowCount ?? 0} test account(s)`);
  } finally {
    await client.end();
  }
}
