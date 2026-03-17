/**
 * @file src/services/cost-calculator.js
 * @description Cost Calculator — calculates LLM API costs
 * 成本计算器 — 计算 LLM API 成本
 * 
 * Pricing is configurable per provider/model
 * 每个提供商/模型的定价可配置
 */
const { logger } = require('../utils/logger');

class CostCalculator {
  constructor() {
    // Default pricing (per 1M tokens)
    // Can be overridden via setPricing()
    this.pricing = {
      anthropic: {
        'claude-opus-4-5': { input: 15.0, output: 75.0 },
        'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
        'claude-haiku-3-5': { input: 0.8, output: 4.0 },
        'claude-3-opus': { input: 15.0, output: 75.0 },
        'claude-3-sonnet': { input: 3.0, output: 15.0 },
        'claude-3-haiku': { input: 0.25, output: 1.25 },
        default: { input: 3.0, output: 15.0 },
      },
      openai: {
        'gpt-4o': { input: 5.0, output: 15.0 },
        'gpt-4o-mini': { input: 0.15, output: 0.6 },
        'gpt-4-turbo': { input: 10.0, output: 30.0 },
        'gpt-4': { input: 30.0, output: 60.0 },
        'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
        'o1': { input: 15.0, output: 60.0 },
        'o1-mini': { input: 3.0, output: 12.0 },
        'o3': { input: 10.0, output: 40.0 },
        default: { input: 5.0, output: 15.0 },
      },
      minimax: {
        'abab6.5s-chat': { input: 1.0, output: 1.0 },
        'abab6.5g-chat': { input: 4.0, output: 4.0 },
        'abab5.5s-chat': { input: 1.0, output: 1.0 },
        default: { input: 1.0, output: 1.0 },
      },
      google: {
        'gemini-2.0-flash': { input: 0.0, output: 0.0 },
        'gemini-1.5-pro': { input: 1.25, output: 5.0 },
        'gemini-1.5-flash': { input: 0.075, output: 0.3 },
        default: { input: 0.075, output: 0.3 },
      },
      'open-source': {
        default: { input: 0.0, output: 0.0 },
      },
    };
    
    // Currency
    this.currency = 'USD';
    
    logger.info('CostCalculator initialized with default pricing');
  }

  /**
   * Set custom pricing for a provider
   * @param {string} provider - Provider name
   * @param {object} pricing - { model: { input, output } }
   */
  setPricing(provider, pricing) {
    this.pricing[provider] = { ...this.pricing[provider], ...pricing };
    logger.info({ provider, pricing }, 'CostCalculator: Updated pricing');
  }

  /**
   * Calculate cost for a request
   * @param {object} params - { provider, model, inputTokens, outputTokens }
   * @returns {number} Cost in USD
   */
  calculate(params) {
    const { provider, model, inputTokens = 0, outputTokens = 0 } = params;
    
    if (!provider || provider === 'unknown') {
      return 0;
    }
    
    const providerPricing = this.pricing[provider] || this.pricing['open-source'];
    const modelPricing = providerPricing[model] || providerPricing.default;
    
    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;
    
    return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Get pricing for a provider
   * @param {string} provider - Provider name
   * @returns {object} Pricing object
   */
  getPricing(provider) {
    return this.pricing[provider] || this.pricing['open-source'];
  }

  /**
   * Get all pricing
   * @returns {object} All pricing
   */
  getAllPricing() {
    return this.pricing;
  }

  /**
   * Calculate total cost from usage
   * @param {Array} usages - Array of { provider, model, inputTokens, outputTokens }
   * @returns {object} { total, byProvider, byModel }
   */
  calculateTotal(usages = []) {
    let total = 0;
    const byProvider = {};
    const byModel = {};
    
    for (const usage of usages) {
      const cost = this.calculate(usage);
      total += cost;
      
      const { provider = 'unknown', model = 'unknown' } = usage;
      byProvider[provider] = (byProvider[provider] || 0) + cost;
      byModel[`${provider}:${model}`] = (byModel[`${provider}:${model}`] || 0) + cost;
    }
    
    return { total: Math.round(total * 10000) / 10000, byProvider, byModel };
  }
}

const costCalculator = new CostCalculator();

module.exports = { CostCalculator, costCalculator };
