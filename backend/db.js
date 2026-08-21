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
      // Pool sizing tuned for Neon serverless Postgres. Neon retires idle server
      // connections on its own and can scale compute to zero, so we keep a modest
      // ceiling, close idle clients before Neon does, and fail fast (rather than
      // hang) if a connection can't be acquired — e.g. during a cold start.
      max: Number(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    // Without a pool-level handler, an error on an idle client (e.g. Neon
    // dropping a connection) would surface as an uncaught exception and crash
    // the process. Log it and let the pool discard the client instead.
    pool.on("error", (err) => {
      console.error("Unexpected idle Postgres client error:", err.message);
    });
  }
  return pool;
}

export async function connectDB() {
  // Lightweight connectivity check so the server fails fast if the DB is
  // unreachable. Schema/DDL now lives entirely in schema.sql and runs via
  // `npm run migrate` — we no longer mutate the schema on boot.
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
  console.log("Connected to Neon Postgres");
}
