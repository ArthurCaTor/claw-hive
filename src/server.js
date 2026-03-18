// Load ts-node to compile TypeScript
require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true
  }
});

// Load and run server.ts
module.exports = require('./server.ts');
