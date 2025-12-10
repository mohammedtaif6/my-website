const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOSTNAME = 'localhost';

const server = http.createServer((req, res) => {
  // Parse the URL and remove query strings
  let filePath = '.' + decodeURIComponent(req.url.split('?')[0]);
  
  // Default to index.html
  if (filePath === './') {
    filePath = './index.html';
  }
  
  // Get file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.woff2': 'application/font-woff2',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.log(`404 - Not Found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 - File Not Found</h1><p>Path: ' + filePath + '</p>', 'utf-8');
      } else {
        console.log(`Error reading ${filePath}:`, error.code);
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
      }
    } else {
      console.log(`✓ Serving: ${filePath} (${contentType})`);
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`\n✅ Server running at http://${HOSTNAME}:${PORT}/`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`\n⏹️  Press CTRL+C to stop the server\n`);
});
