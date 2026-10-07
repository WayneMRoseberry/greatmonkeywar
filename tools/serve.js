// Small, dependency-free static web server for browser mode.
//
// Browsers refuse to load ES modules and JSON files from pages opened straight
// from disk (file:// addresses), so the game must be served over http.
// Only the game's own files are served: index.html, src/ and data/.
//
// Usage: npm run web            (default port 8765)
//        PORT=9000 npm run web

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_PORT = 8765;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Top-level files and folders the server is allowed to serve.
const ALLOWED_FILES = new Set(['index.html']);
const ALLOWED_FOLDERS = new Set(['src', 'data']);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'video/webm',
};

/**
 * Turns a request URL into an absolute file path under `root`,
 * or returns null if the path is not allowed.
 */
export function resolveRequestPath(root, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname === '/') pathname = '/index.html';

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || parts.includes('..')) return null;

  const allowed = parts.length === 1
    ? ALLOWED_FILES.has(parts[0])
    : ALLOWED_FOLDERS.has(parts[0]);
  if (!allowed) return null;

  const resolved = path.resolve(root, ...parts);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) return null;
  return resolved;
}

export function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function createServer(root = REPO_ROOT) {
  return http.createServer((req, res) => {
    const filePath = resolveRequestPath(root, req.url);
    if (!filePath) {
      res.writeHead(404).end('Not found');
      return;
    }
    fs.readFile(filePath, (err, body) => {
      if (err) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentTypeFor(filePath),
        // Always fetch fresh files so edits to data show up on reload.
        'Cache-Control': 'no-store',
      });
      res.end(body);
    });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`Great Monkey War (browser mode): http://localhost:${port}`);
  });
}
