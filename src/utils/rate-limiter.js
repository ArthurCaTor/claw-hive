// Simple in-memory rate limiter
const rateLimits = new Map();

const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
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
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits) {
    if (now - record.windowStart > DEFAULT_WINDOW_MS * 2) {
      rateLimits.delete(key);
    }
  }
}, 60000);

module.exports = { createRateLimiter };
