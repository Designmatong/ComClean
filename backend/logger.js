const fs = require('fs');
const path = require('path');
const os = require('os');

// 延迟初始化 —— 不在模块加载时做任何文件 I/O
let _logFile = null;
let _initialized = false;

function _ensureDir() {
  if (_initialized) return;
  _initialized = true;
  const dir = path.join(os.homedir(), 'AppData', 'Roaming', 'ComClean', 'logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  _logFile = path.join(dir, `comclean-${dateStr}.log`);

  // 后台清理旧日志（忽略错误）
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('comclean-') && f.endsWith('.log'))
      .sort();
    while (files.length > 10) {
      try { fs.unlinkSync(path.join(dir, files.shift())); } catch {}
    }
  } catch {}
}

function _write(level, msg) {
  _ensureDir();
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}\n`;
  try { fs.appendFileSync(_logFile, line, 'utf8'); } catch {}
  if (process.env.NODE_ENV !== 'production') {
    const m = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    m(`[ComClean:${level}] ${msg}`);
  }
}

module.exports = {
  info(msg)  { _write('INFO', msg); },
  warn(msg)  { _write('WARN', msg); },
  error(msg) { _write('ERROR', msg); },
};
