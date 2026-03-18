// @ts-nocheck
/**
 * Prometheus Metrics Exporter
 * 
 * Exports metrics in Prometheus format for monitoring.
 */

class MetricsExporter {
  getPrometheusMetrics() {
    const lines = [];
    
    // Get stats from services if available
    let proxyStatus = { running: false, totalCalls: 0, capturesCount: 0, uptimeSeconds: 0 };
    let tokenStats = { totalInputTokens: 0, totalOutputTokens: 0 };
    let costSummary = { totalCost: 0 };
    let alertSummary = { total: 0, unacknowledged: 0, byLevel: {}, byType: {} };
    
    try {
      const { llmProxy } = require('./llm-proxy');
      const { tokenAggregator } = require('./token-aggregator');
      const { costCalculator } = require('./cost-calculator');
      const { alertService } = require('./alert-service');
      
      proxyStatus = llmProxy.getStatus ? llmProxy.getStatus() : proxyStatus;
      tokenStats = tokenAggregator.getStats();
      costSummary = costCalculator.getCostSummary();
      alertSummary = alertService.getSummary();
    } catch (err) {
      // Services not available
    }
    
    // Proxy metrics
    lines.push('# HELP claw_hive_proxy_running Whether the proxy is running');
    lines.push('# TYPE claw_hive_proxy_running gauge');
    lines.push(`claw_hive_proxy_running ${proxyStatus.running ? 1 : 0}`);
    
    lines.push('# HELP claw_hive_proxy_total_calls Total API calls through proxy');
    lines.push('# TYPE claw_hive_proxy_total_calls counter');
    lines.push(`claw_hive_proxy_total_calls ${proxyStatus.totalCalls || 0}`);
    
    lines.push('# HELP claw_hive_proxy_captures_count Number of captures in memory');
    lines.push('# TYPE claw_hive_proxy_captures_count gauge');
    lines.push(`claw_hive_proxy_captures_count ${proxyStatus.capturesCount || 0}`);
    
    lines.push('# HELP claw_hive_proxy_uptime_seconds Proxy uptime in seconds');
    lines.push('# TYPE claw_hive_proxy_uptime_seconds gauge');
    lines.push(`claw_hive_proxy_uptime_seconds ${proxyStatus.uptimeSeconds || 0}`);
    
    // Token metrics
    lines.push('# HELP claw_hive_tokens_input_total Total input tokens');
    lines.push('# TYPE claw_hive_tokens_input_total counter');
    lines.push(`claw_hive_tokens_input_total ${tokenStats.totalInputTokens || 0}`);
    
    lines.push('# HELP claw_hive_tokens_output_total Total output tokens');
    lines.push('# TYPE claw_hive_tokens_output_total counter');
    lines.push(`claw_hive_tokens_output_total ${tokenStats.totalOutputTokens || 0}`);
    
    // Token by model
    lines.push('# HELP claw_hive_tokens_by_model Token usage by model');
    lines.push('# TYPE claw_hive_tokens_by_model gauge');
    if (tokenStats.byModel) {
      for (const [model, stats] of Object.entries(tokenStats.byModel)) {
        const cleanModel = model.replace(/"/g, '\\"');
        lines.push(`claw_hive_tokens_by_model{model="${cleanModel}",type="input"} ${stats.input}`);
        lines.push(`claw_hive_tokens_by_model{model="${cleanModel}",type="output"} ${stats.output}`);
      }
    }
    
    // Cost metrics
    lines.push('# HELP claw_hive_cost_total_usd Total cost in USD');
    lines.push('# TYPE claw_hive_cost_total_usd gauge');
    lines.push(`claw_hive_cost_total_usd ${costSummary.totalCost || 0}`);
    
    // Alert metrics
    lines.push('# HELP claw_hive_alerts_total Total alerts');
    lines.push('# TYPE claw_hive_alerts_total gauge');
    lines.push(`claw_hive_alerts_total ${alertSummary.total || 0}`);
    
    lines.push('# HELP claw_hive_alerts_unacknowledged Unacknowledged alerts');
    lines.push('# TYPE claw_hive_alerts_unacknowledged gauge');
    lines.push(`claw_hive_alerts_unacknowledged ${alertSummary.unacknowledged || 0}`);
    
    // Process metrics
    try {
      const memUsage = process.memoryUsage();
      lines.push('# HELP claw_hive_memory_heap_used_bytes Heap memory used');
      lines.push('# TYPE claw_hive_memory_heap_used_bytes gauge');
      lines.push(`claw_hive_memory_heap_used_bytes ${memUsage.heapUsed}`);
      
      lines.push('# HELP claw_hive_memory_heap_total_bytes Total heap memory');
      lines.push('# TYPE claw_hive_memory_heap_total_bytes gauge');
      lines.push(`claw_hive_memory_heap_total_bytes ${memUsage.heapTotal}`);
      
      lines.push('# HELP claw_hive_memory_rss_bytes Resident set size');
      lines.push('# TYPE claw_hive_memory_rss_bytes gauge');
      lines.push(`claw_hive_memory_rss_bytes ${memUsage.rss}`);
    } catch (err) {
      // Memory stats not available
    }
    
    return lines.join('\n');
  }
}

const metricsExporter = new MetricsExporter();

module.exports = { MetricsExporter, metricsExporter };
