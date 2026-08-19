/* =============================================================================
 *  server.js — Máy chủ tĩnh không phụ thuộc thư viện ngoài
 * -----------------------------------------------------------------------------
 *  Chỉ dùng module lõi của Node.js (http, fs, path) nên KHÔNG cần `npm install`.
 *
 *      node server.js              → http://localhost:3000
 *      PORT=8080 node server.js    → đổi cổng
 *
 *  Dùng khi triển khai lên Render/Railway/Heroku:
 *      Build Command : (để trống)
 *      Start Command : node server.js
 *
 *  Nếu máy chưa cài Node.js: mở thẳng public/index.html bằng trình duyệt,
 *  hoặc chạy serve.ps1 (PowerShell).
 * ========================================================================== */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var ROOT = path.join(__dirname, 'public');
var PORT = process.env.PORT || 3000;

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

http.createServer(function (req, res) {
  var pathname = decodeURIComponent(url.parse(req.url).pathname);
  if (pathname === '/') pathname = '/index.html';

  // Chuẩn hoá đường dẫn rồi kiểm tra vẫn nằm trong thư mục public
  // (chặn kiểu tấn công path traversal: /../../etc/passwd)
  var filePath = path.join(ROOT, path.normalize(pathname));
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 — Truy cập bị từ chối');
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — Không tìm thấy: ' + pathname);
    }
    var type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log('');
  console.log('  DLU Ledger Studio  →  http://localhost:' + PORT);
  console.log('  Thư mục gốc: ' + ROOT);
  console.log('  Nhấn Ctrl+C để dừng.');
  console.log('');
});
