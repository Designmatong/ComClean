const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

let _log = null;
function _getLog() {
  if (!_log) _log = require('./logger');
  return _log;
}

// ---------------------------------------------------------------------------
// 系统根目录 —— 兼容非 C: 盘安装的 Windows
// ---------------------------------------------------------------------------
const SYSROOT = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
const RECYCLE_BIN = `${(process.env.SystemDrive || 'C:')}\\$Recycle.Bin`;
const DELIVERY_OPT_PATH = path.join(
  SYSROOT, 'ServiceProfiles', 'NetworkService', 'AppData',
  'Local', 'Microsoft', 'Windows', 'DeliveryOptimization', 'Cache');

// ---------------------------------------------------------------------------
// 类别定义
// ---------------------------------------------------------------------------
let _browserCachePaths = null;

function getBrowserCachePaths() {
  if (_browserCachePaths) return _browserCachePaths;
  const local = path.join(os.homedir(), 'AppData', 'Local');
  const chrome = path.join(local, 'Google', 'Chrome', 'User Data');
  const edge   = path.join(local, 'Microsoft', 'Edge', 'User Data');
  const candidates = [
    path.join(chrome, 'Default', 'Cache'),
    path.join(chrome, 'Default', 'Code Cache'),
    path.join(chrome, 'Default', 'Service Worker', 'CacheStorage'),
    path.join(edge,   'Default', 'Cache'),
    path.join(edge,   'Default', 'Code Cache'),
    path.join(edge,   'Default', 'Service Worker', 'CacheStorage'),
  ];
  _browserCachePaths = candidates.filter(p => {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
  });
  return _browserCachePaths;
}

const CATEGORIES = [
  { id: 'user_temp',     name: '用户临时文件',         admin: false,
    paths: () => [path.join(os.homedir(), 'AppData', 'Local', 'Temp')] },
  { id: 'system_temp',   name: '系统临时文件',         admin: true,
    paths: () => [path.join(SYSROOT, 'Temp')] },
  { id: 'recycle_bin',   name: '回收站',              admin: true,
    paths: () => [] },
  { id: 'thumb_cache',   name: '缩略图缓存',           admin: false,
    paths: () => [path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer')] },
  { id: 'browser_cache', name: '浏览器缓存',           admin: false,
    paths: () => getBrowserCachePaths() },
  { id: 'recent_items',  name: '最近文档记录',         admin: false,
    paths: () => [path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent')] },
  { id: 'dns_cache',     name: 'DNS缓存',             admin: true,
    paths: () => [] },
  { id: 'wer_reports',   name: 'Windows错误报告',      admin: false,
    paths: () => [path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'WER')] },
  { id: 'dx_cache',      name: 'DirectX着色器缓存',    admin: false,
    paths: () => [path.join(os.homedir(), 'AppData', 'LocalLow', 'Microsoft', 'DirectX Shader Cache')] },
  { id: 'delivery_opt',  name: 'Delivery Optimization', admin: true,
    paths: () => [] },
];

const ICONS = {
  user_temp: '📁', system_temp: '⚙️', recycle_bin: '♻️',
  thumb_cache: '🖼️', browser_cache: '🌐', recent_items: '📄',
  dns_cache: '🌍', wer_reports: '⚠️', dx_cache: '🎮', delivery_opt: '📦',
};

// ---------------------------------------------------------------------------
class Cleaner {
  constructor() {
    this._categories = CATEGORIES;
  }

  static getCategories() {
    return CATEGORIES.map(c => ({ id: c.id, name: c.name, icon: ICONS[c.id] || '📋', admin: c.admin }));
  }

  // ---- 权限检测 ----
  async isAdmin() {
    try {
      await execAsync('net session', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  // ---- 管理员重启（防命令注入）----
  restartAsAdmin(exePath) {
    const appExe = exePath || process.execPath;
    return new Promise((resolve, reject) => {
      // 使用 spawn + 参数数组，单引号无法注入
      const ps = spawn('powershell', [
        '-Command',
        `Start-Process -FilePath '${appExe.replace(/'/g, "''")}' -Verb RunAs`
      ], { stdio: 'ignore', timeout: 10000 });
      ps.on('error', reject);
      ps.on('close', (code) => code === 0 ? resolve(true) : reject(new Error(`Exit ${code}`)));
    });
  }

  // ---- 异步迭代目录大小 ----
  async _getDirSize(dirPath) {
    let totalSize = 0, fileCount = 0;
    const stack = [dirPath];
    while (stack.length) {
      const cur = stack.pop();
      let entries;
      try { entries = await fsp.readdir(cur, { withFileTypes: true }); }
      catch { continue; }
      for (const e of entries) {
        try {
          const fp = path.join(cur, e.name);
          if (e.isDirectory()) { stack.push(fp); }
          else if (e.isFile()) { const s = await fsp.stat(fp); totalSize += s.size; fileCount++; }
        } catch { /* TOCTOU */ }
      }
    }
    return { size: totalSize, files: fileCount };
  }

  // ---- 扫描回收站（语言无关，用 PowerShell Measure-Object）----
  async _scanRecycleBin() {
    try {
      // PowerShell Measure-Object 输出不依赖系统语言
      const { stdout } = await execAsync(
        `powershell -Command "Get-ChildItem -Path '${RECYCLE_BIN}' -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum"`,
        { timeout: 30000, maxBuffer: 1024 * 1024 });
      const size = parseInt(stdout.trim()) || 0;
      return { size, files: 0, status: 'ok' };
    } catch {
      // 回退：用 dir /s /a（注意：非英文系统匹配失败由外层 fallback 处理）
      try {
        const { stdout } = await execAsync(
          `cmd /c "dir /s /a ${RECYCLE_BIN} 2>nul"`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
        // 解析最后一行摘要中的数字（语言无关：从行尾提取数字）
        const lines = stdout.trim().split(/\r?\n/);
        const last = lines[lines.length - 1] || '';
        const nums = last.match(/([\d,]+)\s+bytes/i);
        if (nums) {
          return { size: parseInt(nums[1].replace(/,/g, '')) || 0, files: 0, status: 'ok' };
        }
        // 进一步回退：用 total 行
        const totalLine = lines.find(l => /\d+.*bytes/i.test(l));
        if (totalLine) {
          const m = totalLine.match(/([\d,]+)\s+bytes/i);
          return { size: m ? parseInt(m[1].replace(/,/g, '')) : 0, files: 0, status: 'ok' };
        }
        return { size: 0, files: 0, status: 'skipped' };
      } catch {
        return { size: 0, files: 0, status: 'skipped' };
      }
    }
  }

  // ---- 扫描 ----
  async scanAll(onProgress) {
    const results = [];
    const admin = await this.isAdmin();
    const total = this._categories.length;
    let cur = 0;

    for (const cat of this._categories) {
      if (onProgress) onProgress({ current: cur, total, category: cat.id, status: 'scanning' });

      let size = 0, files = 0, status = 'ok';

      if (cat.admin && !admin) {
        results.push({ id: cat.id, name: cat.name, size: 0, files: 0, status: 'admin_required', icon: ICONS[cat.id] });
        cur++; if (onProgress) onProgress({ current: cur, total, category: cat.id, status: 'done' });
        continue;
      }

      try {
        if (cat.id === 'recycle_bin') {
          const r = await this._scanRecycleBin();
          size = r.size; files = r.files;
          if (r.status !== 'ok') status = r.status;
        } else if (cat.id === 'dns_cache') {
          status = 'ok';
        } else if (cat.id === 'delivery_opt') {
          try { await fsp.access(DELIVERY_OPT_PATH); const r = await this._getDirSize(DELIVERY_OPT_PATH); size = r.size; files = r.files; } catch { status = 'skipped'; }
        } else {
          for (const p of cat.paths()) {
            try { await fsp.access(p); const r = await this._getDirSize(p); size += r.size; files += r.files; } catch {}
          }
        }
      } catch (err) {
        status = 'error';
        _getLog().error(`Scan failed for ${cat.id}: ${err.message}`);
      }

      // 仅在正常扫描完成后判定"干净"，不覆盖 error/skipped 状态
      if (status === 'ok' && size === 0 && cat.id !== 'dns_cache' && cat.id !== 'recycle_bin') {
        status = 'clean';
      }
      results.push({ id: cat.id, name: cat.name, size, files, status, icon: ICONS[cat.id] });
      cur++; if (onProgress) onProgress({ current: cur, total, category: cat.id, status: 'done' });
    }
    return results;
  }

  // ---- 清理目录 ----
  async _deleteDirContents(dirPath) {
    let deleted = 0, freed = 0;
    const stack = [dirPath];
    while (stack.length) {
      const cur = stack.pop();
      let entries;
      try { entries = await fsp.readdir(cur, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const fp = path.join(cur, e.name);
        try {
          if (e.isDirectory()) {
            try { const sub = await this._getDirSize(fp); await fsp.rm(fp, { recursive: true, force: true }); deleted += sub.files; freed += sub.size; }
            catch (err) { if (!['ENOENT','EACCES','EPERM'].includes(err.code)) _getLog().warn(`Cannot delete dir ${fp}: ${err.message}`); }
          } else if (e.isFile()) {
            try { const s = await fsp.stat(fp); await fsp.unlink(fp); deleted++; freed += s.size; }
            catch (err) { if (!['ENOENT','EACCES','EPERM'].includes(err.code)) _getLog().warn(`Cannot delete file ${fp}: ${err.message}`); }
          }
        } catch {}
      }
    }
    return { deleted, freed };
  }

  // ---- 清理 ----
  async cleanAll(results, onProgress) {
    const summary = { totalFreed: 0, totalDeleted: 0, details: [] };
    const actionable = results.filter(r => r.status !== 'admin_required' && r.status !== 'clean');
    let cur = 0;

    for (const item of results) {
      if (item.status === 'admin_required' || item.status === 'clean') {
        summary.details.push({ id: item.id, name: item.name, freed: 0, deleted: 0, status: item.status });
        continue;
      }
      if (onProgress) onProgress({ current: cur, total: actionable.length, category: item.id, status: 'cleaning' });

      const cat = this._categories.find(c => c.id === item.id);
      if (!cat) continue;

      let freed = 0, deleted = 0, status = 'ok';
      try {
        if (item.id === 'recycle_bin') {
          try { await execAsync(`cmd /c rd /s /q ${RECYCLE_BIN} 2>nul`, { timeout: 30000 }); freed = item.size; deleted = item.files; }
          catch { try { await execAsync('powershell -Command "Clear-RecycleBin -Force"', { timeout: 30000 }); freed = item.size; deleted = item.files; } catch { status = 'failed'; } }
        } else if (item.id === 'dns_cache') {
          try { await execAsync('ipconfig /flushdns', { timeout: 10000 }); } catch { status = 'failed'; }
        } else if (item.id === 'delivery_opt') {
          try { await fsp.access(DELIVERY_OPT_PATH); const r = await this._deleteDirContents(DELIVERY_OPT_PATH); freed = r.freed; deleted = r.deleted; } catch { status = 'failed'; }
        } else {
          for (const p of cat.paths()) {
            try { await fsp.access(p); const r = await this._deleteDirContents(p); freed += r.freed; deleted += r.deleted; } catch {}
          }
        }
      } catch (err) {
        status = 'failed';
        _getLog().error(`Clean failed for ${item.id}: ${err.message}`);
      }

      summary.totalFreed += freed; summary.totalDeleted += deleted;
      summary.details.push({ id: item.id, name: item.name, freed, deleted, status });
      cur++; if (onProgress) onProgress({ current: cur, total: actionable.length, category: item.id, status: 'done' });
    }
    _getLog().info(`Cleaned: ${summary.totalDeleted} files, ${summary.totalFreed} bytes`);
    return summary;
  }
}

module.exports = { Cleaner };
