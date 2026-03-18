// @ts-nocheck
/**
 * Token Aggregator Service
 * 
 * Aggregates token usage from captures and provides statistics.
 * Used by Dashboard and Cost pages.
 */

const { llmProxy } = require('./llm-proxy');

class TokenAggregator {
  /**
   * Get aggregated token statistics from captures
   */
  getStats() {
    const captures = llmProxy.getCaptures();
    
    const stats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      averageInputTokens: 0,
      averageOutputTokens: 0,
      captureCount: captures.length,
      byModel: {},
      byHour: {},
    };

    for (const capture of captures) {
      const input = capture.tokens?.input || capture.usage?.input_tokens || 0;
      const output = capture.tokens?.output || capture.usage?.output_tokens || 0;
      const model = capture.request?.body?.model || 'unknown';
      
      // Totals
      stats.totalInputTokens += input;
      stats.totalOutputTokens += output;
      
      // By model
      if (!stats.byModel[model]) {
        stats.byModel[model] = { input: 0, output: 0, count: 0 };
      }
      stats.byModel[model].input += input;
      stats.byModel[model].output += output;
      stats.byModel[model].count += 1;
      
      // By hour
      const hour = capture.timestamp?.slice(0, 13) || 'unknown';
      if (!stats.byHour[hour]) {
        stats.byHour[hour] = { input: 0, output: 0, count: 0 };
      }
      stats.byHour[hour].input += input;
      stats.byHour[hour].output += output;
      stats.byHour[hour].count += 1;
    }
    
    stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;
    stats.averageInputTokens = captures.length > 0 
      ? Math.round(stats.totalInputTokens / captures.length) 
      : 0;
    stats.averageOutputTokens = captures.length > 0 
      ? Math.round(stats.totalOutputTokens / captures.length) 
      : 0;
    
    return stats;
  }

  /**
   * Get token stats for a specific time range
   */
  getStatsForRange(startTime, endTime) {
    const captures = llmProxy.getCaptures().filter(c => {
      const timestamp = new Date(c.timestamp);
      return timestamp >= startTime && timestamp <= endTime;
    });
    
    // Same aggregation logic
    const stats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      averageInputTokens: 0,
      averageOutputTokens: 0,
      captureCount: captures.length,
      byModel: {},
      byHour: {},
    };

    for (const capture of captures) {
      const input = capture.tokens?.input || capture.usage?.input_tokens || 0;
      const output = capture.tokens?.output || capture.usage?.output_tokens || 0;
      const model = capture.request?.body?.model || 'unknown';
      
      stats.totalInputTokens += input;
      stats.totalOutputTokens += output;
      
      if (!stats.byModel[model]) {
        stats.byModel[model] = { input: 0, output: 0, count: 0 };
      }
      stats.byModel[model].input += input;
      stats.byModel[model].output += output;
      stats.byModel[model].count += 1;
    }
    
    stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;
    stats.averageInputTokens = captures.length > 0 
      ? Math.round(stats.totalInputTokens / captures.length) : 0;
    stats.averageOutputTokens = captures.length > 0 
      ? Math.round(stats.totalOutputTokens / captures.length) : 0;
    
    return stats;
  }
}

const tokenAggregator = new TokenAggregator();

module.exports = { TokenAggregator, tokenAggregator };
