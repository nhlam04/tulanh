// Check the library form with the callback, printing the summary shape.
const http = require('node:http');
const newman = require('newman');
const t0 = Date.now();
const sec = () => ((Date.now() - t0) / 1000).toFixed(1);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: '00000', message: 'ok', data: null }));
});

server.listen(5094, () => {
  const collection = { info: { name: 'check', schema: 'https://schema.getpostman.com/json/collection/v2.1.0' }, item: [{ name: 'get', request: { method: 'GET', url: 'http://127.0.0.1:5094/x' } }] };
  newman.run({ collection, timeout: 5000, reporters: 'cli' }, (err, summary) => {
    if (err) { console.log(sec(), 'error:', err.message); process.exit(1); }
    const run = summary.run;
    console.log(sec(), 'callback fired. responseCount shape:', JSON.stringify(run.responseCount), 'failures:', run.failures.length);
    server.close();
    process.exit(0);
  });
  setTimeout(() => { console.log(sec(), 'no callback after 20 seconds'); process.exit(2); }, 20000);
});
