/**
 * 创建 GitHub Release 并上传 ZIP 附件。
 *
 * 使用方式:
 *   1. 设置环境变量 GITHUB_TOKEN (Personal Access Token, 需要 repo 权限)
 *   2. 设置环境变量 GITHUB_REPO (格式: owner/repo)
 *   3. 可选: 设置 GITHUB_TAG (默认 v1.0.0)
 *   4. node scripts/create-release.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || 'Designmatong/ComClean';
const TAG = process.env.GITHUB_TAG || 'v1.0.0';
const BASE_DIR = path.resolve(__dirname, '..');
const ZIP_PATH = path.join(BASE_DIR, 'ComClean-v1.0.0.zip');

if (!TOKEN) {
  console.error('✗ 错误: 请设置 GITHUB_TOKEN 环境变量');
  console.error('  例如: set GITHUB_TOKEN=ghp_xxxx');
  process.exit(1);
}

const API = '/repos/' + REPO;

function request(method, hostname, urlPath, data = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname, path: urlPath, method,
      headers: {
        'Authorization': 'token ' + TOKEN,
        'User-Agent': 'ComClean',
        'Accept': 'application/vnd.github.v3+json',
      }
    };
    if (data) {
      opts.headers['Content-Type'] = contentType;
      opts.headers['Content-Length'] = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    }
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, d: JSON.parse(body), h: res.headers }); }
        catch { resolve({ s: res.statusCode, d: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    // 1. Get the latest commit on main
    process.stdout.write('1. Getting latest commit... ');
    let r = await request('GET', 'api.github.com', API + '/git/refs/heads/main');
    if (r.s !== 200) { console.log('✗ ' + JSON.stringify(r.d)); return; }
    const commitSha = r.d.object.sha;
    console.log('✓ ' + commitSha.slice(0, 7));

    // 2. Create tag object
    process.stdout.write('2. Creating tag ' + TAG + '... ');
    r = await request('POST', 'api.github.com', API + '/git/tags', JSON.stringify({
      tag: TAG,
      message: 'ComClean ' + TAG,
      object: commitSha,
      type: 'commit',
    }));
    if (r.s !== 201) { console.log('✗ ' + JSON.stringify(r.d)); return; }
    const tagSha = r.d.sha;
    console.log('✓ ' + tagSha.slice(0, 7));

    // 3. Create tag ref
    process.stdout.write('3. Creating tag reference... ');
    r = await request('POST', 'api.github.com', API + '/git/refs', JSON.stringify({
      ref: 'refs/tags/' + TAG,
      sha: tagSha,
    }));
    if (r.s === 201) console.log('✓');
    else if (r.s === 422) console.log('already exists ✓');
    else { console.log('✗ ' + JSON.stringify(r.d)); return; }

    // 4. Create release
    process.stdout.write('4. Creating release... ');
    const releaseBody = [
      '## ComClean ' + TAG,
      '',
      'C 盘一键清理工具 — 安全 · 快速 · 现代',
      '',
      '### 使用说明',
      '',
      '1. 下载 ComClean-' + TAG + '.zip 并解压',
      '2. 运行 ComClean.exe',
      '3. 推荐右键 → 以管理员身份运行',
      '4. 点击「开始扫描」→「一键清理」',
    ].join('\n');

    r = await request('POST', 'api.github.com', API + '/releases', JSON.stringify({
      tag_name: TAG,
      name: 'ComClean ' + TAG,
      body: releaseBody,
      draft: false,
      prerelease: false,
    }));
    if (r.s !== 201) { console.log('✗ ' + JSON.stringify(r.d)); return; }
    const releaseId = r.d.id;
    const uploadUrl = r.d.upload_url.replace('{?name,label}', '?name=ComClean-' + TAG + '.zip');
    console.log('✓ release #' + releaseId);

    // 5. Upload asset
    if (!fs.existsSync(ZIP_PATH)) {
      console.log('⚠ ZIP not found at ' + ZIP_PATH + ', skipping upload');
    } else {
      console.log('5. Uploading ZIP (' + (fs.statSync(ZIP_PATH).size / 1024 / 1024).toFixed(1) + ' MB)...');
      const fileData = fs.readFileSync(ZIP_PATH);

      r = await request('POST', 'uploads.github.com', '/repos/' + REPO + '/releases/' + releaseId + '/assets?name=ComClean-' + TAG + '.zip', fileData, 'application/zip');

      if (r.s === 201) {
        console.log('   ✓ Asset uploaded!');
      } else {
        console.log('   ✗ Upload failed: ' + (r.d.message || JSON.stringify(r.d)));
        console.log('   Status: ' + r.s);
      }
    }

    console.log('\n✓✓✓ Release complete!');
    console.log('https://github.com/' + REPO + '/releases/tag/' + TAG);
  } catch (err) {
    console.error('\n✗ Error:', err.message);
  }
})();
