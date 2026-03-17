// Register ts-node before loading TypeScript files
require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true
  }
});

module.exports = require('./server.ts');
