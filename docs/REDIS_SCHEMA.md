# Redis Cache Schema

## Key Structure and TTL Strategy

### API Key Authentication Cache
```
apikey:{sha256_hash} (Hash)
  user_id:     UUID
  api_key_id:  UUID
  tier:        free | vip | enterprise
  rpm_limit:   int
  tpm_limit:   int
TTL: 300s (5 min) — refreshed on each authenticated request
```

### Channel Health & Load Balancing
```
channel:{id} (Hash)
  status:          active | rate_limited | error
  error_count:     int
  concurrency:     int
  last_used:       timestamp
TTL: persistent, updated by health check loop

channel_pool:{model} (Sorted Set)
  member: channel_id
  score:  health_score (weight * (1 - error_rate))
TTL: persistent, recalculated every 30s
```

### Rate Limiting (Token Bucket / Sliding Window)
```
ratelimit:rpm:{user_id} (Sorted Set)
  Sliding window of request timestamps
  ZREMRANGEBYSCORE on every check
TTL: 60s

ratelimit:tpm:{user_id} (String counter)
  Current minute token count
TTL: 60s, auto-reset

ratelimit:concurrent:{user_id} (String)
  Active concurrent requests
TTL: 120s
```

### User State Cache
```
user:{user_id} (Hash)
  balance_cents:  int
  daily_used:     int
  tier:           string
TTL: 600s (10 min), invalidated on billing update

user:{user_id}:daily_tokens (String)
  Counter for today's token usage
TTL: until midnight UTC
```

### Session / JWT Cache (for frontend API)
```
session:{jwt_token_hash} (String)
  user_id JSON
TTL: matches JWT expiry (24h)

blacklist:{jwt_token_hash} (String)
  1 (for revoked tokens)
TTL: matches remaining JWT expiry
```

### Subscription Quota Reset
```
quota:reset:{user_id} (String)
  next_reset_timestamp
TTL: persistent
```

## Cluster / Sentinel Considerations
- All keys use `{}` hash tags when cross-slot operations needed
- Rate limit keys use Lua scripting for atomicity (sliding window ZADD + ZREMRANGEBYSCORE)
- Channel pool uses Sorted Set with ZRANGEBYSCORE for O(log N) selection
