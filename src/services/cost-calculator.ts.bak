/**
 * @file src/services/cost-calculator.ts
 * @description Cost Calculator — calculates LLM API costs
 * 成本计算器 — 计算 LLM API 成本
 * 
 * Pricing is configurable per provider/model
 * 每个提供商/模型的定价可配置
 */

interface PricingTier {
  input: number;
  output: number;
}

interface ProviderPricing {
  [model: string]: PricingTier;
}

interface AllPricing {
  [provider: string]: ProviderPricing;
}

interface CostParams {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface Usage extends CostParams {}

interface CostResult {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

class CostCalculator {
  private pricing: AllPricing;
  private currency: string;

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
    
    console.log('CostCalculator initialized with default pricing');
  }

  /**
   * Set custom pricing for a provider
   * @param provider - Provider name
   * @param pricing - { model: { input, output } }
   */
  setPricing(provider: string, pricing: ProviderPricing): void {
    this.pricing[provider] = { ...this.pricing[provider], ...pricing };
    console.log('CostCalculator: Updated pricing', { provider, pricing });
  }

  /**
   * Calculate cost for a request
   * @param params - { provider, model, inputTokens, outputTokens }
   * @returns Cost in USD
   */
  calculate(params: CostParams): number {
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
   * @param provider - Provider name
   * @returns Pricing object
   */
  getPricing(provider: string): ProviderPricing {
    return this.pricing[provider] || this.pricing['open-source'];
  }

  /**
   * Get all pricing
   * @returns All pricing
   */
  getAllPricing(): AllPricing {
    return this.pricing;
  }

  /**
   * Calculate total cost from usage
   * @param usages - Array of { provider, model, inputTokens, outputTokens }
   * @returns { total, byProvider, byModel }
   */
  calculateTotal(usages: Usage[] = []): CostResult {
    let total = 0;
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    
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

export { CostCalculator, costCalculator };
