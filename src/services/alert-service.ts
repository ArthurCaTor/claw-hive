// @ts-nocheck
/**
 * Alert Service
 * 
 * Monitors system metrics and generates alerts.
 * Alerts can be viewed in dashboard or sent to external services.
 */

const { EventEmitter } = require('events');

const DEFAULT_RULES = [
  {
    id: 'high-latency',
    name: 'High Latency',
    type: 'high_latency',
    condition: (capture) => capture.latency_ms > 10000,
    level: 'warning',
    message: 'Request latency exceeded 10 seconds',
    enabled: true,
  },
  {
    id: 'very-high-latency',
    name: 'Very High Latency',
    type: 'high_latency',
    condition: (capture) => capture.latency_ms > 30000,
    level: 'error',
    message: 'Request latency exceeded 30 seconds',
    enabled: true,
  },
  {
    id: 'api-error',
    name: 'API Error',
    type: 'high_error_rate',
    condition: (capture) => capture.response?.status >= 500,
    level: 'error',
    message: 'API returned 5xx error',
    enabled: true,
  },
  {
    id: 'rate-limit',
    name: 'Rate Limit',
    type: 'rate_limit',
    condition: (capture) => capture.response?.status === 429,
    level: 'warning',
    message: 'Rate limit hit (429)',
    enabled: true,
  },
  {
    id: 'high-tokens',
    name: 'High Token Usage',
    type: 'high_cost',
    condition: (capture) => (capture.tokens?.input || 0) + (capture.tokens?.output || 0) > 100000,
    level: 'warning',
    message: 'Single request used over 100k tokens',
    enabled: true,
  },
];

const MAX_ALERTS = 500;

class AlertService extends EventEmitter {
  constructor() {
    super();
    this.alerts = [];
    this.rules = [...DEFAULT_RULES];
    this.alertCounter = 0;
    
    console.log('[AlertService] Initialized with', this.rules.length, 'rules');
  }

  /**
   * Check capture against all rules
   */
  checkCapture(capture) {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      
      try {
        if (rule.condition(capture)) {
          this.createAlert(rule.type, rule.level, rule.message, {
            captureId: capture.id,
            model: capture.request?.body?.model,
            latency: capture.latency_ms,
            status: capture.response?.status,
            ruleId: rule.id,
          });
        }
      } catch (err) {
        console.error(`[AlertService] Rule ${rule.id} error:`, err.message);
      }
    }
  }

  /**
   * Create a new alert
   */
  createAlert(type, level, message, details = {}) {
    const alert = {
      id: `alert-${++this.alertCounter}`,
      type,
      level,
      message,
      details,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    
    this.alerts.push(alert);
    
    // Trim old alerts
    if (this.alerts.length > MAX_ALERTS) {
      this.alerts = this.alerts.slice(-MAX_ALERTS);
    }
    
    // Emit event
    this.emit('alert', alert);
    
    console.log(`[AlertService] ${level.toUpperCase()}: ${message}`);
    
    return alert;
  }

  /**
   * Get all alerts
   */
  getAlerts(options = {}) {
    let filtered = [...this.alerts];
    
    if (options.level) {
      filtered = filtered.filter(a => a.level === options.level);
    }
    if (options.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }
    if (options.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === options.acknowledged);
    }
    
    // Sort by timestamp descending
    filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Acknowledge all alerts
   */
  acknowledgeAll() {
    let count = 0;
    for (const alert of this.alerts) {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Get alert summary
   */
  getSummary() {
    const byLevel = {};
    const byType = {};
    let unacknowledged = 0;
    
    for (const alert of this.alerts) {
      byLevel[alert.level] = (byLevel[alert.level] || 0) + 1;
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      if (!alert.acknowledged) unacknowledged++;
    }
    
    return {
      total: this.alerts.length,
      unacknowledged,
      byLevel,
      byType,
    };
  }

  /**
   * Get rules
   */
  getRules() {
    return [...this.rules];
  }

  /**
   * Update rule
   */
  updateRule(ruleId, updates) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  /**
   * Clear all alerts
   */
  clearAlerts() {
    const count = this.alerts.length;
    this.alerts = [];
    return count;
  }
}

const alertService = new AlertService();

module.exports = { AlertService, alertService };
