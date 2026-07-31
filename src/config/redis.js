import { createClient } from "redis";

const redis = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    RESP: 2
});

redis.on("error", (error) => {
    console.error("Redis error:", error.message || error);
});

await redis.connect();
console.log("Connected to Redis");

export default redis;
