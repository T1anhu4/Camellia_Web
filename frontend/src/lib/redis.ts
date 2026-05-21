import Redis from "ioredis"

const globalForRedis = globalThis as unknown as { redis: Redis | undefined }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_ADDR || "localhost:6379", {
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null // stop retrying
      return Math.min(times * 200, 2000)
    },
    lazyConnect: true,
  })

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis
}

// Ensure connected (call once at startup)
let connected = false
export async function ensureRedisConnection() {
  if (!connected) {
    try {
      await redis.connect()
      connected = true
    } catch {
      // Redis is optional for frontend — allow graceful degradation
      console.warn("Redis connection failed, caching disabled")
    }
  }
}
