// @ts-nocheck
/**
 * Cost Calculator Service
 * 
 * Calculates API costs based on token usage and provider pricing.
 * Pricing is configurable per model.
 */

// Pricing per 1M tokens (USD)
const DEFAULT_PRICING = {
  // MiniMax
  'MiniMax-M2.7': { input: 0.70, output: 2.80 },
  'MiniMax-M2.5': { input: 0.70, output: 2.80 },
  'MiniMax-Text-01': { input: 0.50, output: 2.00 },
  
  // Anthropic
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-sonnet-4': { input: 3.00, output: 15.00 },
  'claude-opus-4': { input: 15.00, output: 75.00 },
  
  // OpenAI
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  
  // Default fallback
  'unknown': { input: 1.00, output: 3.00 },
};

class CostCalculator {
  constructor() {
    this.pricing = { ...DEFAULT_PRICING };
    this.loadCustomPricing();
  }

  /**
   * Load custom pricing from config file
   */
  loadCustomPricing() {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config', 'pricing.json');
      
      if (fs.existsSync(configPath)) {
        const custom = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.pricing = { ...this.pricing, ...custom };
        console.log('[CostCalculator] Loaded custom pricing');
      }
    } catch (err) {
      console.warn('[CostCalculator] Using default pricing');
    }
  }

  /**
   * Get pricing for a model
   */
  getPricing(model) {
    // Try exact match first
    if (this.pricing[model]) {
      return this.pricing[model];
    }
    
    // Try partial match
    for (const [key, value] of Object.entries(this.pricing)) {
      if (model.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return this.pricing['unknown'];
  }

  /**
   * Calculate cost for tokens
   */
  calculateCost(model, inputTokens, outputTokens) {
    const pricing = this.getPricing(model);
    
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    
    return {
      inputCost: Math.round(inputCost * 10000) / 10000,
      outputCost: Math.round(outputCost * 10000) / 10000,
      totalCost: Math.round((inputCost + outputCost) * 10000) / 10000,
    };
  }

  /**
   * Get cost summary from all captures
   */
  getCostSummary() {
    const { tokenAggregator } = require('./token-aggregator');
    const tokenStats = tokenAggregator.getStats();
    const { llmProxy } = require('./llm-proxy');
    
    const byModel = [];
    let totalCost = 0;
    let totalInputCost = 0;
    let totalOutputCost = 0;
    const byDay = {};

    // Calculate by model
    for (const [model, stats] of Object.entries(tokenStats.byModel)) {
      const costs = this.calculateCost(model, stats.input, stats.output);
      
      byModel.push({
        model,
        inputTokens: stats.input,
        outputTokens: stats.output,
        inputCost: costs.inputCost,
        outputCost: costs.outputCost,
        totalCost: costs.totalCost,
        requestCount: stats.count,
      });
      
      totalCost += costs.totalCost;
      totalInputCost += costs.inputCost;
      totalOutputCost += costs.outputCost;
    }

    // Calculate by day from captures
    const captures = llmProxy.getCaptures();
    for (const capture of captures) {
      const day = capture.timestamp?.slice(0, 10) || 'unknown';
      const model = capture.request?.body?.model || 'unknown';
      const input = capture.tokens?.input || 0;
      const output = capture.tokens?.output || 0;
      const costs = this.calculateCost(model, input, output);
      
      byDay[day] = (byDay[day] || 0) + costs.totalCost;
    }

    // Sort byModel by cost descending
    byModel.sort((a, b) => b.totalCost - a.totalCost);

    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalInputCost: Math.round(totalInputCost * 10000) / 10000,
      totalOutputCost: Math.round(totalOutputCost * 10000) / 10000,
      byModel,
      byDay,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update pricing for a model
   */
  setPricing(model, input, output) {
    this.pricing[model] = { input, output };
  }

  /**
   * Get all pricing
   */
  getAllPricing() {
    return { ...this.pricing };
  }
}

const costCalculator = new CostCalculator();

module.exports = { CostCalculator, costCalculator };
