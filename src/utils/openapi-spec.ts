// @ts-nocheck
/**
 * OpenAPI/Swagger specification for Claw-Hive API
 */

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Claw-Hive API',
    description: 'OpenClaw Agent Monitoring Dashboard - API Documentation\n\n监控 OpenClaw Agents 的仪表板 API',
    version: '1.0.0',
    contact: {
      name: 'Arthur Wang'
    }
  },
  servers: [
    {
      url: 'http://localhost:8080',
      description: 'Local development server'
    }
  ],
  tags: [
    { name: 'Agents', description: 'Agent management and status' },
    { name: 'Health', description: 'System health checks' },
    { name: 'Stats', description: 'Statistics and cost tracking' },
    { name: 'Sessions', description: 'Session management' },
    { name: 'Debug', description: 'Debug and proxy features' },
    { name: 'Captures', description: 'LLM call captures' }
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    uptime: { type: 'number' },
                    timestamp: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/agents': {
      get: {
        tags: ['Agents'],
        summary: 'Get all agents',
        responses: {
          '200': {
            description: 'List of all agents',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' }
                }
              }
            }
          }
        }
      }
    },
    '/api/agents/config': {
      get: {
        tags: ['Agents'],
        summary: 'Get agent configuration',
        responses: {
          '200': {
            description: 'Agent config from openclaw.json',
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          }
        }
      }
    },
    '/api/agent/{id}': {
      get: {
        tags: ['Agents'],
        summary: 'Get single agent',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Agent details'
          },
          '404': {
            description: 'Agent not found'
          }
        }
      }
    },
    '/api/stats': {
      get: {
        tags: ['Stats'],
        summary: 'Get system statistics',
        responses: {
          '200': {
            description: 'Stats object'
          }
        }
      }
    },
    '/api/debug-proxy/status': {
      get: {
        tags: ['Debug'],
        summary: 'Get LLM proxy status',
        responses: {
          '200': {
            description: 'Proxy status'
          }
        }
      }
    },
    '/api/debug-proxy/captures': {
      get: {
        tags: ['Captures'],
        summary: 'Get LLM call captures',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'List of captures'
          }
        }
      }
    }
  }
};

module.exports = spec;
