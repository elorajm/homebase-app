import "dotenv/config";
import { Client } from "pg";
import { E2E_EMAIL_DOMAIN } from "./helpers";

// Removes data created by the end-to-end run. Membership and session rows are removed by database cascades.
// Households go first because a household's owner cannot be deleted while the household exists.
export default async function globalTeardown() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const pattern = `%@${E2E_EMAIL_DOMAIN}`;
    const households = await client.query(
      `delete from "Household" where "ownerId" in (select id from "User" where email like $1)`,
      [pattern],
    );
    const users = await client.query(`delete from "User" where email like $1`, [pattern]);
    console.log(`[e2e] removed ${households.rowCount ?? 0} household(s) and ${users.rowCount ?? 0} test account(s)`);
  } finally {
    await client.end();
  }
}

