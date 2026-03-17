// Module Discoverer - Dynamic module discovery for OpenClaw
const fs = require('fs');
const path = require('path');

interface AppendMessageResult {
  found: boolean;
  modulePath: string | null;
  exportName: string | null;
  isWritable: boolean;
  method: string;
}

interface LLMClientResult {
  found: boolean;
  supportsBaseUrl: boolean;
  envVarName: string | null;
  configPath: string | null;
}

class ModuleDiscoverer {
  // Find appendMessage module in OpenClaw dist directory
  static async findAppendMessageModule(openclawRoot: string): Promise<AppendMessageResult> {
    const distDir = path.join(openclawRoot, 'dist');
    
    if (!fs.existsSync(distDir)) {
      return { found: false, modulePath: null, exportName: null, isWritable: false, method: 'not_found' };
    }

    const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const fullPath = path.join(distDir, file);
      let content: string;
      
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch (e) {
        continue;
      }

      // Pattern matching for appendMessage function
      const patterns = [
        /exports\.appendMessage\s*=/,
        /appendMessage\s*:\s*(?:async\s+)?function/,
        /(?:async\s+)?function\s+appendMessage/,
        /\.appendMessage\s*=\s*(?:async\s+)?\(/,
      ];

      const matched = patterns.some(p => p.test(content));
      if (!matched) continue;

      // Try to require and check export
      try {
        const mod = require(fullPath);
        if (typeof mod.appendMessage === 'function') {
          const descriptor = Object.getOwnPropertyDescriptor(mod, 'appendMessage');
          const isWritable = descriptor
            ? descriptor.writable !== false && descriptor.configurable !== false
            : true;

          return {
            found: true,
            modulePath: fullPath,
            exportName: 'appendMessage',
            isWritable,
            method: isWritable ? 'direct_export' : 'prototype_patch',
          };
        }
      } catch (err) {
        console.warn(`[Discovery] Failed to load ${file}: ${(err as Error).message}`);
      }
    }

    return {
      found: false,
      modulePath: null,
      exportName: null,
      isWritable: false,
      method: 'not_found',
    };
  }

  // Find LLM client module for proxy fallback
  static async findLLMClientModule(openclawRoot: string): Promise<LLMClientResult> {
    const distDir = path.join(openclawRoot, 'dist');
    
    if (!fs.existsSync(distDir)) {
      return { found: false, supportsBaseUrl: false, envVarName: null, configPath: null };
    }

    const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const fullPath = path.join(distDir, file);
      let content: string;
      
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch (e) {
        continue;
      }

      const envPatterns = [
        /process\.env\.(ANTHROPIC_BASE_URL)/,
        /process\.env\.(OPENAI_BASE_URL)/,
        /process\.env\.(MINIMAX_BASE_URL)/,
        /baseURL\s*[=:]/,
      ];

      for (const pattern of envPatterns) {
        const match = content.match(pattern);
        if (match) {
          return {
            found: true,
            supportsBaseUrl: true,
            envVarName: match[1] || null,
            configPath: fullPath,
          };
        }
      }
    }

    return { found: false, supportsBaseUrl: false, envVarName: null, configPath: null };
  }

  // Resolve OpenClaw root directory
  static resolveOpenClawRoot(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    
    // Try nvm global node_modules
    const nvmPath = path.join(home, '.nvm', 'versions', 'node', process.version, 'lib', 'node_modules', 'openclaw');
    if (fs.existsSync(nvmPath)) return nvmPath;
    
    // Try npm global
    try {
      const mainPath = require.resolve('openclaw');
      return path.dirname(path.dirname(mainPath));
    } catch {
      // Try common paths
      const candidates = [
        path.join(process.cwd(), 'node_modules', 'openclaw'),
        path.join(home, '.npm-global', 'lib', 'node_modules', 'openclaw'),
      ];
      
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      
      // Default to nvm path
      const defaultPath = path.join(home, '.nvm', 'versions', 'node', 'v22.22.0', 'lib', 'node_modules', 'openclaw');
      if (fs.existsSync(defaultPath)) return defaultPath;
      
      throw new Error('OpenClaw installation not found');
    }
  }
}

export { ModuleDiscoverer };
