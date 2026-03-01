const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  // 设置CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // 如果是根路径，提供emoji-check.html
  if (pathname === '/') {
    pathname = '/emoji-check.html';
  }

  let filePath;
  // 处理emoji文件的路径 - 映射到实际的assets目录
  if (pathname.startsWith('/assets/emoji/')) {
    // 映射到上级目录的assets/emoji
    const relativePath = pathname.substring('/assets/'.length);
    filePath = path.join(__dirname, '..', relativePath);
  } else if (pathname.startsWith('/assets/')) {
    // 其他assets文件
    const relativePath = pathname.substring('/assets/'.length);
    filePath = path.join(__dirname, '..', relativePath);
  } else {
    // 测试目录下的文件
    filePath = path.join(__dirname, pathname);
  }
  const ext = path.parse(filePath).ext;
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // 添加调试信息
  console.log(`Request: ${req.url} -> ${filePath}`);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`🔥 Emoji Atlas Test Server running at:`);
  console.log(`📱 http://localhost:${PORT}/`);
  console.log(`🧪 http://localhost:${PORT}/emoji-atlas-debug.html`);
  console.log(`✅ 现在可以访问atlas文件了！`);
  console.log(`\n按 Ctrl+C 停止服务器`);
});