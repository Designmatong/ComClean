const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class Cleaner {
  constructor() {
    this.categories = [
      { id: 'user_temp',     name: '用户临时文件',         paths: [path.join(os.homedir(), 'AppData', 'Local', 'Temp')],                              admin: false },
      { id: 'system_temp',   name: '系统临时文件',         paths: ['C:\\Windows\\Temp'],                                                                 admin: true  },
      { id: 'recycle_bin',   name: '回收站',              paths: [],                                                                                    admin: true  },
      { id: 'thumb_cache',   name: '缩略图缓存',           paths: [path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer')],   admin: false },
      { id: 'browser_cache', name: '浏览器缓存',           paths: this._getBrowserCachePaths(),                                                         admin: false },
      { id: 'recent_items',  name: '最近文档记录',         paths: [path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent')],   admin: false },
      { id: 'dns_cache',     name: 'DNS缓存',             paths: [],                                                                                    admin: true  },
      { id: 'wer_reports',   name: 'Windows错误报告',      paths: [path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'WER')],        admin: false },
      { id: 'dx_cache',      name: 'DirectX着色器缓存',    paths: [path.join(os.homedir(), 'AppData', 'LocalLow', 'Microsoft', 'DirectX Shader Cache')], admin: false },
      { id: 'delivery_opt',  name: 'Delivery Optimization', paths: [],                                                                                   admin: true  },
    ];
  }

  _getBrowserCachePaths() {
    const local = path.join(os.homedir(), 'AppData', 'Local');
    const chrome = path.join(local, 'Google', 'Chrome', 'User Data');
    const edge   = path.join(local, 'Microsoft', 'Edge', 'User Data');
    return [
      path.join(chrome, 'Default', 'Cache'),
      path.join(chrome, 'Default', 'Code Cache'),
      path.join(chrome, 'Default', 'Service Worker', 'CacheStorage'),
      path.join(edge,   'Default', 'Cache'),
      path.join(edge,   'Default', 'Code Cache'),
      path.join(edge,   'Default', 'Service Worker', 'CacheStorage'),
    ].filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
  }

  isAdmin() {
    try {
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  restartAsAdmin() {
    const appPath = process.execPath;
    const scriptPath = process.argv[1];
    execSync(`powershell -Command "Start-Process '${appPath}' -ArgumentList '${scriptPath}' -Verb RunAs"`, { stdio: 'ignore' });
    return true;
  }

  _getDirSize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        try {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            const sub = this._getDirSize(fullPath);
            totalSize += sub.size;
            fileCount += sub.files;
          } else if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            totalSize += stat.size;
            fileCount++;
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    return { size: totalSize, files: fileCount };
  }

  async scanAll() {
    const results = [];
    const admin = this.isAdmin();

    for (const cat of this.categories) {
      let totalSize = 0;
      let totalFiles = 0;
      let status = 'ok';

      if (cat.admin && !admin) {
        results.push({ id: cat.id, name: cat.name, size: 0, files: 0, status: 'admin_required', icon: this._getIcon(cat.id) });
        continue;
      }

      if (cat.id === 'recycle_bin') {
        try {
          const out = execSync('cmd /c "dir /s /a C:\\$Recycle.Bin 2>nul || dir /s /a %SYSTEMDRIVE%\\$Recycle.Bin 2>nul"', { encoding: 'utf8', maxBuffer: 1024*1024*10 });
          const match = out.match(/File\(s\)\s+([\d,]+)\s+bytes/);
          if (match) totalSize = parseInt(match[1].replace(/,/g, '')) || 0;
          status = 'ok';
        } catch { status = 'skipped'; }
      } else if (cat.id === 'dns_cache') {
        totalSize = 0;
        totalFiles = 0;
        status = 'ok';
      } else if (cat.id === 'delivery_opt') {
        const dopPath = 'C:\\Windows\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache';
        try {
          if (fs.existsSync(dopPath)) {
            const r = this._getDirSize(dopPath);
            totalSize = r.size;
            totalFiles = r.files;
          }
          status = 'ok';
        } catch { status = 'skipped'; }
      } else {
        for (const p of cat.paths) {
          try {
            if (fs.existsSync(p)) {
              const r = this._getDirSize(p);
              totalSize += r.size;
              totalFiles += r.files;
            }
          } catch { /* skip */ }
        }
      }

      if (totalSize === 0 && cat.id !== 'dns_cache' && cat.id !== 'recycle_bin') {
        status = 'clean';
      }

      results.push({ id: cat.id, name: cat.name, size: totalSize, files: totalFiles, status, icon: this._getIcon(cat.id) });
    }

    return results;
  }

  _getIcon(id) {
    const icons = {
      user_temp:     '\uD83D\uDCC1',
      system_temp:   '\u2699\uFE0F',
      recycle_bin:   '\u267B\uFE0F',
      thumb_cache:   '\uD83D\uDDBC\uFE0F',
      browser_cache: '\uD83C\uDF10',
      recent_items:  '\uD83D\uDCC4',
      dns_cache:     '\uD83C\uDF0D',
      wer_reports:   '\u26A0\uFE0F',
      dx_cache:      '\uD83C\uDFAE',
      delivery_opt:  '\uD83D\uDCE6',
    };
    return icons[id] || '\uD83D\uDCCB';
  }

  _deleteDirContents(dirPath, removeRoot = false) {
    let deleted = 0;
    let freed = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        try {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            try {
              const sub = this._getDirSize(fullPath);
              fs.rmSync(fullPath, { recursive: true, force: true });
              deleted += sub.files;
              freed += sub.size;
            } catch { /* skip */ }
          } else if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            fs.unlinkSync(fullPath);
            deleted++;
            freed += stat.size;
          }
        } catch { /* skip */ }
      }
      if (removeRoot) {
        try { fs.rmdirSync(dirPath); } catch {}
      }
    } catch { /* skip */ }
    return { deleted, freed };
  }

  async cleanAll(results) {
    const admin = this.isAdmin();
    const summary = { totalFreed: 0, totalDeleted: 0, details: [] };

    for (const item of results) {
      if (item.status === 'admin_required' || item.status === 'clean') {
        summary.details.push({ id: item.id, name: item.name, freed: 0, deleted: 0, status: item.status });
        continue;
      }

      const cat = this.categories.find(c => c.id === item.id);
      if (!cat) continue;

      let freed = 0;
      let deleted = 0;
      let status = 'ok';

      if (item.id === 'recycle_bin') {
        try {
          execSync('cmd /c rd /s /q %SYSTEMDRIVE%\\$Recycle.Bin 2>nul', { stdio: 'ignore' });
          freed = item.size;
          deleted = item.files;
          status = 'ok';
        } catch {
          try {
            execSync('powershell -Command "Clear-RecycleBin -Force"', { stdio: 'ignore' });
            freed = item.size;
            deleted = item.files;
            status = 'ok';
          } catch { status = 'failed'; }
        }
      } else if (item.id === 'dns_cache') {
        try {
          execSync('ipconfig /flushdns', { stdio: 'ignore' });
          status = 'ok';
        } catch { status = 'failed'; }
      } else if (item.id === 'delivery_opt') {
        const dopPath = 'C:\\Windows\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache';
        try {
          if (fs.existsSync(dopPath)) {
            const r = this._deleteDirContents(dopPath);
            freed = r.freed;
            deleted = r.deleted;
          }
          status = 'ok';
        } catch { status = 'failed'; }
      } else {
        for (const p of cat.paths) {
          try {
            if (fs.existsSync(p)) {
              const r = this._deleteDirContents(p);
              freed += r.freed;
              deleted += r.deleted;
            }
          } catch { /* skip */ }
        }
      }

      summary.totalFreed += freed;
      summary.totalDeleted += deleted;
      summary.details.push({ id: item.id, name: item.name, freed, deleted, status });
    }

    return summary;
  }
}

module.exports = { Cleaner };
