require('ts-node').register({compilerOptions:{module:'commonjs'}});

const express = require('express');
const app = express();

const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

console.log('1. Loading CORS...');
app.use(cors());
console.log('2. Loading compression...');
app.use(compression({ 
  filter: (req, res) => {
    console.log('   Compression filter called:', req.path);
    return compression.filter(req, res);
  }
}));
console.log('3. Loading JSON parser...');
app.use(express.json({ limit: '10mb' }));
console.log('4. Loading request logger...');
app.use((req, res, next) => {
  console.log('   REQUEST:', req.method, req.url);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('   RESPONSE:', req.method, req.url, res.statusCode, duration + 'ms');
  });
  next();
});

console.log('5. Loading routes...');
const routeFiles = [
  './src/routes/health-routes',
  './src/routes/agent-routes',
  './src/routes/stats-routes',
];

for (const routeFile of routeFiles) {
  try {
    const routeModule = require(routeFile);
    if (routeModule.default) {
      routeModule.default(app);
      console.log('   Loaded:', routeFile);
    }
  } catch (err) {
    console.log('   Failed:', routeFile, err.message);
  }
}

console.log('6. Starting server...');
const server = app.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});

setTimeout(() => process.exit(0), 10000);
