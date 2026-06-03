import "dotenv/config"
import {Redis} from '@upstash/redis'
import {Ratelimit} from "@upstash/ratelimit"

const rateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(100, "60 s"),
    analytics: true,
})

export default rateLimit;
