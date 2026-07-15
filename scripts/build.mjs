#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CLIENT_DIR = path.join(DIST, 'client');
const OUTPUT = path.join(DIST, 'output');
const OUTPUT_RESOURCE = path.join(DIST, 'output_resource');
const OUTPUT_STATIC = path.join(DIST, 'output_static');
const OUTPUT_CAPABILITIES = path.join(DIST, 'output_capabilities');
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

process.env.CLIENT_BASE_PATH = process.env.MIAODA_APP_ID ? `/app/${process.env.MIAODA_APP_ID}` : '';
process.env.ASSETS_CDN_PATH = process.env.MIAODA_RESOURCE_CDN_PREFIX || '/';
process.env.STATIC_ASSETS_BASE_URL = process.env.MIAODA_STATIC_CDN_PREFIX || '';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(path.dirname(to));
  fs.cpSync(from, to, { recursive: true });
  return true;
}

function copyStaticAssets() {
  const source = path.join(ROOT, 'shared', 'static');
  if (!fs.existsSync(source)) return false;

  ensureDir(OUTPUT_STATIC);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(OUTPUT_STATIC, entry.name);
    if (entry.isFile() && /\.(ts|tsx|js|jsx)$/i.test(entry.name)) continue;
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
  return true;
}

fs.rmSync(DIST, { recursive: true, force: true });

const build = spawnSync(
  process.execPath,
  [VITE_BIN, 'build', '--outDir', CLIENT_DIR, '--emptyOutDir'],
  { cwd: ROOT, stdio: 'inherit', env: process.env },
);

if (build.status !== 0) {
  if (build.error) {
    console.error(build.error.message);
  }
  process.exit(build.status ?? 1);
}

ensureDir(OUTPUT);
for (const fileName of ['index.html', 'routes.json']) {
  copyIfExists(path.join(CLIENT_DIR, fileName), path.join(OUTPUT, fileName));
}

copyIfExists(path.join(CLIENT_DIR, 'assets'), path.join(OUTPUT_RESOURCE, 'assets'));
copyStaticAssets();
copyIfExists(path.join(ROOT, 'shared', 'capabilities'), OUTPUT_CAPABILITIES);

fs.rmSync(CLIENT_DIR, { recursive: true, force: true });

console.log('Build complete');
console.log('  HTML         -> dist/output/');
if (fs.existsSync(OUTPUT_RESOURCE)) console.log('  Resource     -> dist/output_resource/');
if (fs.existsSync(OUTPUT_STATIC)) console.log('  Static       -> dist/output_static/');
if (fs.existsSync(OUTPUT_CAPABILITIES)) console.log('  Capabilities -> dist/output_capabilities/');
