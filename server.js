const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const ADMIN_USER = process.env.ADMIN_USER || 'rawley';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'w1341995';
const DATA_FILE = path.join(__dirname, 'playlists.json');
const STATIC_DIR = __dirname;

// Simple token = base64(sha256(password + salt))
function generateToken(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return Buffer.from(hash + ':' + salt).toString('base64');
}

let currentToken = null;

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  return authHeader.slice(7) === currentToken;
}

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read playlists.json:', e.message);
  }
  return { favorites: [], playlists: [], updatedAt: null };
}

function writeData(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function sendJSON(res, statusCode, obj) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}

function serveStatic(res, filePath) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // API: Login
  if (method === 'POST' && url.pathname === '/api/login') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (username !== ADMIN_USER) {
          sendJSON(res, 401, { success: false, error: '用户名错误' });
        } else if (password === ADMIN_PASSWORD) {
          currentToken = generateToken(password);
          sendJSON(res, 200, { success: true, token: currentToken, user: username });
        } else {
          sendJSON(res, 401, { success: false, error: '密码错误' });
        }
      } catch (e) {
        sendJSON(res, 400, { success: false, error: '请求格式错误' });
      }
    });
    return;
  }

  // API: Get playlists (public)
  if (method === 'GET' && url.pathname === '/api/playlists') {
    sendJSON(res, 200, readData());
    return;
  }

  // API: Save playlists (admin only)
  if (method === 'POST' && url.pathname === '/api/playlists') {
    if (!verifyToken(req.headers['authorization'])) {
      sendJSON(res, 403, { success: false, error: '未登录或登录已过期' });
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        writeData(data);
        sendJSON(res, 200, { success: true, updatedAt: data.updatedAt });
      } catch (e) {
        sendJSON(res, 400, { success: false, error: '数据格式错误' });
      }
    });
    return;
  }

  // Static files
  let filePath = path.join(STATIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  // Prevent directory traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStatic(res, filePath);
  } else {
    // Fallback to index.html for SPA routes
    serveStatic(res, path.join(STATIC_DIR, 'index.html'));
  }
});

server.listen(PORT, () => {
  console.log(`MusicSquare server running at http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  if (!fs.existsSync(DATA_FILE)) {
    writeData({ favorites: [], playlists: [] });
    console.log('Created initial playlists.json');
  }
});
