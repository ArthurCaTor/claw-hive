// @ts-nocheck
/**
 * Capture Search Service
 * 
 * Full-text search across captures.
 */

const { llmProxy } = require('./llm-proxy');

class CaptureSearch {
  /**
   * Search captures
   */
  search(options) {
    const { 
      query, 
      fields = ['all'], 
      limit = 50, 
      caseSensitive = false 
    } = options;
    
    const captures = llmProxy.getCaptures();
    const results = [];
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    
    for (const capture of captures) {
      const matches = [];
      let score = 0;
      
      // Search in model name
      if (fields.includes('all') || fields.includes('model')) {
        const model = capture.request?.body?.model || '';
        if (this.matches(model, searchQuery, caseSensitive)) {
          matches.push('model');
          score += 10;
        }
      }
      
      // Search in messages
      if (fields.includes('all') || fields.includes('messages')) {
        const messages = capture.request?.body?.messages || [];
        for (const msg of messages) {
          const content = typeof msg.content === 'string' ? msg.content : '';
          if (this.matches(content, searchQuery, caseSensitive)) {
            matches.push('messages');
            score += 5;
            break;
          }
        }
      }
      
      // Search in assistant response
      if (fields.includes('all') || fields.includes('response')) {
        const text = capture.response?.body?.assistant_text || '';
        if (this.matches(text, searchQuery, caseSensitive)) {
          matches.push('response');
          score += 5;
        }
      }
      
      // Search in system prompt
      if (fields.includes('all') || fields.includes('system')) {
        const system = capture.request?.body?.system || '';
        if (this.matches(system, searchQuery, caseSensitive)) {
          matches.push('system');
          score += 3;
        }
      }
      
      // Search in tools
      if (fields.includes('all') || fields.includes('tools')) {
        const tools = JSON.stringify(capture.request?.body?.tools || []);
        if (this.matches(tools, searchQuery, caseSensitive)) {
          matches.push('tools');
          score += 2;
        }
      }
      
      if (matches.length > 0) {
        results.push({ capture, score, matches });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }
  
  matches(text, query, caseSensitive) {
    if (!text) return false;
    const str = String(text || '');
    const searchText = caseSensitive ? str : str.toLowerCase();
    return searchText.includes(query);
  }
}

const captureSearch = new CaptureSearch();

module.exports = { CaptureSearch, captureSearch };
