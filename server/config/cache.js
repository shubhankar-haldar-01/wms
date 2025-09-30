const redis = require("redis");
require("dotenv").config();

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Connection pool settings
  family: 4, // IPv4
  keepAlive: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Only add password if it's explicitly set
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

// Create Redis client with error handling
let client;
try {
  client = redis.createClient(redisConfig);
} catch (error) {
  console.warn("Redis not available, using in-memory fallback:", error.message);
  client = null;
}

// Connection event handlers (only if client exists)
if (client) {
  client.on("connect", () => {
    console.log("Connected to Redis cache");
  });

  client.on("ready", () => {
    console.log("Redis cache ready");
  });

  client.on("error", (err) => {
    console.error("Redis cache error:", err);
    // Don't exit the process, continue without cache
  });

  client.on("end", () => {
    console.log("Redis cache connection ended");
  });
}

// Cache utility functions
const cache = {
  // Get cached data
  async get(key) {
    if (!client) {
      return null; // No cache available
    }
    try {
      if (!client.isOpen) {
        await client.connect();
      }
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  },

  // Set cached data with TTL
  async set(key, data, ttlSeconds = 300) {
    // Default 5 minutes
    if (!client) {
      return false; // No cache available
    }
    try {
      if (!client.isOpen) {
        await client.connect();
      }
      await client.setEx(key, ttlSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  },

  // Delete cached data
  async del(key) {
    if (!client) {
      return false; // No cache available
    }
    try {
      if (!client.isOpen) {
        await client.connect();
      }
      await client.del(key);
      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  },

  // Delete multiple keys with pattern
  async delPattern(pattern) {
    if (!client) {
      return false; // No cache available
    }
    try {
      if (!client.isOpen) {
        await client.connect();
      }
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return true;
    } catch (error) {
      console.error("Cache delete pattern error:", error);
      return false;
    }
  },

  // Check if cache is available
  isAvailable() {
    return client && client.isOpen;
  },

  // Close connection
  async close() {
    if (!client) {
      return; // No client to close
    }
    try {
      if (client.isOpen) {
        await client.quit();
      }
    } catch (error) {
      console.error("Cache close error:", error);
    }
  },
};

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Closing Redis cache...");
  await cache.close();
});

process.on("SIGTERM", async () => {
  console.log("Closing Redis cache...");
  await cache.close();
});

module.exports = cache;
