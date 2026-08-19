import dotenv from "dotenv";

dotenv.config();

// Optional pg import for environments without PostgreSQL driver
let pool;
try {
  // Dynamically import pg to avoid module not found errors when pg is not installed
  const pgModule = await import('pg');
  const { Pool } = pgModule;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });
  pool.on('connect', () => console.log('Connected to PostgreSQL database'));
} catch (e) {
  console.warn('pg package not found, using mock DB pool');
  // Minimal mock with query method returning empty rows
  pool = {
    query: async () => ({ rows: [] })
  };
}
export default pool;
