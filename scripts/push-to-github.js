/**
 * 将源文件逐项推送到 GitHub 仓库。
 *
 * 使用方式:
 *   1. 设置环境变量 GITHUB_TOKEN (Personal Access Token, 需要 repo 权限)
 *   2. 设置环境变量 GITHUB_REPO (格式: owner/repo, 例如 Designmatong/ComClean)
 *   3. 可选: 设置 GITHUB_BRANCH (默认 main)
 *   4. node scripts/push-to-github.js
 *
 * 也可使用 GitHub CLI:
 *   gh auth login
 *   然后用 git push
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || 'Designmatong/ComClean';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const BASE_DIR = path.resolve(__dirname, '..');

if (!TOKEN) {
  console.error('✗ 错误: 请设置 GITHUB_TOKEN 环境变量');
  console.error('  例如: set GITHUB_TOKEN=ghp_xxxx');
  console.error('  或者使用 GitHub CLI: gh auth login');
  process.exit(1);
}

const FILES = [
  '.gitignore', 'README.md', 'package.json', 'package-lock.json',
  '.eslintrc.json',
  'main.js', 'preload.js',
  'backend/cleaner.js', 'backend/logger.js',
  'src/index.html', 'src/styles.css', 'src/renderer.js',
  'test/cleaner.test.js',
  'scripts/push-to-github.js', 'scripts/create-release.js',
  '启动ComClean.bat',
];

function request(method, urlPath, data = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath, method,
      headers: {
        'Authorization': 'token ' + TOKEN,
        'User-Agent': 'ComClean',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, d: JSON.parse(body) }); }
        catch { resolve({ s: res.statusCode, d: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getFileSha(relPath) {
  const enc = relPath.replace(/\\/g, '/').split('/').map(p => encodeURIComponent(p)).join('/');
  const r = await request('GET', '/repos/' + REPO + '/contents/' + enc);
  if (r.s === 200 && r.d.sha) return r.d.sha;
  return null;
}

(async () => {
  console.log('Uploading to https://github.com/' + REPO + '\n');

  let ok = 0, fail = 0;
  for (const relPath of FILES) {
    const fp = path.join(BASE_DIR, relPath);
    if (!fs.existsSync(fp)) { continue; }
    process.stdout.write('  ' + relPath + '... ');

    const existingSha = await getFileSha(relPath);
    const content = fs.readFileSync(fp).toString('base64');
    const enc = relPath.replace(/\\/g, '/').split('/').map(p => encodeURIComponent(p)).join('/');

    const body = { message: existingSha ? 'Update ' + relPath : 'Add ' + relPath, content, branch: BRANCH };
    if (existingSha) body.sha = existingSha;

    const r = await request('PUT', '/repos/' + REPO + '/contents/' + enc, JSON.stringify(body));
    if (r.s === 200 || r.s === 201) { console.log((existingSha ? 'updated' : 'created') + ' ✓'); ok++; }
    else { console.log('✗ ' + (r.d.message || '')); fail++; }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n--- ' + ok + ' OK, ' + fail + ' failed ---');
  console.log('https://github.com/' + REPO);
})();
