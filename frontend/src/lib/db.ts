import { Pool, types } from "pg"

// Map numeric types to number for convenience
types.setTypeParser(1700, parseFloat) // numeric → float
types.setTypeParser(20, parseInt) // int8 → number

const globalForPool = globalThis as unknown as { pgPool: Pool | undefined }

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

if (process.env.NODE_ENV !== "production") {
  globalForPool.pgPool = pool
}

// Helper: single row query
export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const { rows } = await pool.query(sql, params)
  return (rows[0] as T) ?? null
}

// Helper: multiple rows
export async function queryMany<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
  return rows as T[]
}

// Helper: execute (no return)
export async function execute(sql: string, params?: unknown[]): Promise<void> {
  await pool.query(sql, params)
}
