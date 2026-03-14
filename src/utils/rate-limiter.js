// Simple in-memory rate limiter
const rateLimits = new Map();

const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;
const CLEANUP_INTERVAL_MS = 60000;

// Store references to cleanup intervals
const cleanupIntervals = new Map();

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  
  return (req, res, next) => {
    // Validate IP to prevent memory issues
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (!ip || ip.length > 45) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    const key = ip;
    const now = Date.now();
    
    let record = rateLimits.get(key);
    if (!record || now - record.windowStart > windowMs) {
      // New window
      record = { windowStart: now, count: 0 };
      rateLimits.set(key, record);
    }
    
    record.count++;
    
    if (record.count > maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
      });
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    
    next();
  };
};

// Cleanup old entries periodically
const startCleanup = (windowMs) => {
  const interval = Math.max(windowMs * 2, CLEANUP_INTERVAL_MS);
  
  if (!cleanupIntervals.has(windowMs)) {
    const id = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of rateLimits) {
        if (now - record.windowStart > windowMs * 2) {
          rateLimits.delete(key);
        }
      }
    }, interval);
    
    cleanupIntervals.set(windowMs, id);
  }
};

// Start default cleanup
startCleanup(DEFAULT_WINDOW_MS);

module.exports = { createRateLimiter };
