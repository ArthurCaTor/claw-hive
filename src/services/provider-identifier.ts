// @ts-nocheck
/**
 * @file src/services/provider-identifier.ts
 * @description Provider Identifier — detects LLM provider from request
 * 提供商识别器 — 从请求中识别 LLM 提供商
 * 
 * Detection strategy:
 * 1. Check x-llm-provider header
 * 2. Check model field in request body
 * 3. Check URL path patterns
 */

interface ProviderResult {
  provider: string;
  model: string;
  source: 'header' | 'body' | 'url' | 'none';
}

interface RequestWithBody {
  headers: Record<string, string | string[] | undefined>;
  body?: {
    model?: string;
    [key: string]: unknown;
  };
  path: string;
  url: string;
}

class ProviderIdentifier {
  private modelPatterns: Record<string, string[]>;
  private urlPatterns: Record<string, string[]>;

  constructor() {
    // Known model patterns
    this.modelPatterns = {
      anthropic: ['claude', 'sonnet', 'haiku', 'opus'],
      openai: ['gpt-', 'o1', 'o2', 'o3', 'gpt-4', 'gpt-3.5', 'chatgpt'],
      minimax: ['minimax', 'abab'],
      google: ['gemini', 'palm'],
      'open-source': ['llama', 'mistral', 'qwen', 'deepseek', 'command'],
    };
    
    // URL path patterns
    this.urlPatterns = {
      anthropic: ['/v1/messages'],
      openai: ['/v1/chat/completions', '/v1/completions'],
      minimax: ['/v1/text/chatcompletion_v2', '/compatible-mode/'],
      google: ['/v1beta/models'],
    };
  }

  /**
   * Identify provider from request
   * @param req - Express request object
   * @returns Provider result with source
   */
  identify(req: RequestWithBody): ProviderResult {
    // 1. Check explicit header
    const headerProvider = req.headers['x-llm-provider'];
    if (headerProvider) {
      return { 
        provider: String(headerProvider).toLowerCase(), 
        model: req.body?.model || 'unknown',
        source: 'header'
      };
    }

    // 2. Check model field in body
    const model = req.body?.model || '';
    if (model) {
      const provider = this.detectFromModel(model);
      if (provider !== 'unknown') {
        return { provider, model, source: 'body' };
      }
    }

    // 3. Check URL path
    const provider = this.detectFromUrl(req.path, req.url);
    if (provider !== 'unknown') {
      return { provider, model: model || 'unknown', source: 'url' };
    }

    return { provider: 'unknown', model: model || 'unknown', source: 'none' };
  }

  /**
   * Detect provider from model name
   * @param model - Model name
   * @returns Provider name
   */
  detectFromModel(model: string): string {
    if (!model) return 'unknown';
    
    const lower = model.toLowerCase();
    for (const [provider, patterns] of Object.entries(this.modelPatterns)) {
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          return provider;
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * Detect provider from URL path
   * @param path - Request path
   * @param url - Full URL
   * @returns Provider name
   */
  detectFromUrl(path: string, url: string): string {
    const fullUrl = path + url;
    
    for (const [provider, patterns] of Object.entries(this.urlPatterns)) {
      for (const pattern of patterns) {
        if (fullUrl.includes(pattern)) {
          return provider;
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * Get all supported providers
   * @returns List of provider names
   */
  getSupportedProviders(): string[] {
    return Object.keys(this.modelPatterns);
  }
}

const providerIdentifier = new ProviderIdentifier();

export { ProviderIdentifier, providerIdentifier };
