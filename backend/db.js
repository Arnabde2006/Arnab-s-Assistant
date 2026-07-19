import pkg from "pg";

const { Pool, types } = pkg;

// Keep DATE columns as plain "YYYY-MM-DD" strings instead of pg's default
// JS Date conversion (which shifts by timezone and breaks our date-string logic).
types.setTypeParser(1082, (val) => val);

let pool;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set in .env");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function connectDB() {
  // Simple connectivity check so the server fails fast if the DB is unreachable.
  const client = await getPool().connect();
  client.release();
  console.log("Connected to Neon Postgres");
}
