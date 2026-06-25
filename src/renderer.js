// =========================================================================
// ComClean – 渲染进程
// =========================================================================
// 状态机: idle → scanning → scanned → cleaning → cleaned → (循环 或 idle)
// =========================================================================

// ---- i18n ----
const T = {
  'ready':               '🟢 就绪',
  'scanning':            '🔍 扫描中...',
  'scan.complete':       '✅ 扫描完成',
  'scan.failed':         '❌ 扫描失败',
  'cleaning':            '🧹 清理中...',
  'clean.complete':      '✨ 清理完成',
  'clean.failed':        '❌ 清理失败',
  'admin.required':      '🛡️ 需管理员',
  'admin.hint':          '需要管理员权限',
  'clean.ok':            '✅ 干净',
  'clean.noNeed':        '无需清理',
  'clean.done':          '已清理',
  'clean.flush':         '💨 可刷新',
  'clean.flushDesc':     '刷新DNS解析缓存',
  'scanning.status':     '扫描中...',
  'cleaning.status':     '清理中...',
  'found':               '可清理',
  'progress.scanning':   '正在扫描系统垃圾文件...',
  'progress.cleaning':   '正在清理垃圾文件...',
  'progress.scanDone':   '扫描完成！',
  'progress.cleanDone':  '清理完成！',
  'summary.label':       '可释放空间',
  'clean.btn':           '🧹 一键清理',
  'clean.btn.cleaning':  '⏳ 清理中...',
  'result.label':        '已释放空间',
  'result.cleaned':      '共清理 ',
  'action.scan':         '开始扫描',
  'action.rescan':       '重新扫描',
  'action.scanning':     '扫描中',
  'action.cleaning':     '清理中',
  'action.done':         '已完成',
  'action.retry':        '重试',
  'back':                '🔄 重新扫描',
  'admin.warn':          '建议以管理员身份运行',
  'admin.warnSub':       '以管理员身份运行可获得更彻底的清理效果',
  'admin.restart':       '重新启动',
  'admin.confirming':    '请确认...',
  'header.title':        'C盘一键清理',
  'header.desc':         '安全扫描并清理系统中的垃圾文件，释放磁盘空间',
};

function t(key) { return T[key] || key; }

// ---- DOM 缓存 ----
const dom = {};
function cacheDom() {
  const ids = [
    'actionBtn','btnLabel','btnIcon',
    'progressArea','progressFill','progressText',
    'categories','summary','summaryValue','cleanBtn',
    'result','resultValue','resultSub','resultDetails','backBtn',
    'statusBadge','adminWarning','adminBtn',
    'closeBtn','minBtn',
    'headerTitle','headerDesc',
    'themeToggle',
  ];
  for (const id of ids) dom[id] = document.getElementById(id);
}
cacheDom();

// ---- 状态机 ----
const State = {
  _mode: 'idle',       // 'idle' | 'scanning' | 'scanned' | 'cleaning' | 'cleaned'
  results: [],
  selected: new Set(), // 用户选中的类别 id
  cleanResult: null,

  get mode() { return this._mode; },

  transition(newMode) {
    const valid = {
      idle:      ['scanning'],
      scanning:  ['scanned', 'idle'],       // idle = error
      scanned:   ['cleaning', 'scanning'],   // rescan
      cleaning:  ['cleaned', 'scanned'],     // scanned = error fallback
      cleaned:   ['scanning', 'idle'],
    };
    if (!valid[this._mode] || !valid[this._mode].includes(newMode)) {
      console.warn(`Invalid state transition: ${this._mode} → ${newMode}`);
    }
    this._mode = newMode;
    console.log(`State: ${this._mode}`);
  },

  reset() {
    this._mode = 'idle';
    this.results = [];
    this.selected = new Set();
    this.cleanResult = null;
  },

  setResults(arr) {
    this.results = arr;
    // 默认选中所有可清理项
    arr.forEach(r => {
      if (r.status !== 'admin_required' && r.status !== 'clean' && (r.size > 0 || r.id === 'dns_cache')) {
        this.selected.add(r.id);
      }
    });
  },

  toggleSelected(id) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    updateSummaryUI();
  },
};

// ---- 工具函数 ----
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 3);
  const size = bytes / Math.pow(k, i);
  return (size < 10 && i > 0 ? size.toFixed(1) : Math.round(size)) + ' ' + units[i];
}

function formatFiles(n) {
  if (n === 0) return '0 个文件';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k 个文件';
  return n + ' 个文件';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'textContent') e.textContent = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c instanceof Node) e.appendChild(c);
  }
  return e;
}

// ---- 标题栏 ----
dom.closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());
dom.minBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());

// ---- 主题切换 ----
function initTheme() {
  const saved = localStorage.getItem('comclean-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}
initTheme();
dom.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next || 'light');
  if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('comclean-theme', current === 'dark' ? 'light' : 'dark');
});

// ---- 管理员检测（延迟到首帧渲染后，不阻塞 UI 出现）----
setTimeout(async () => {
  try {
    const isAdmin = await window.electronAPI.checkAdmin();
    if (!isAdmin) {
      dom.adminWarning.style.display = 'flex';
    }
  } catch (e) {
    console.log('Admin check skipped:', e.message);
  }
}, 100);

dom.adminBtn.addEventListener('click', async () => {
  dom.adminBtn.disabled = true;
  dom.adminBtn.textContent = t('admin.confirming');
  try {
    await window.electronAPI.restartAdmin();
  } catch (e) {
    dom.adminBtn.disabled = false;
    dom.adminBtn.textContent = t('admin.restart');
  }
});

// ---- 设置真实进度 ----
function setProgress(pct, text) {
  dom.progressFill.style.width = Math.min(pct, 100) + '%';
  dom.progressText.textContent = text;
}

function showProgress(show) {
  if (show) dom.progressArea.classList.add('visible');
  else dom.progressArea.classList.remove('visible');
}

// ---- 扫描 ----
async function startScan() {
  if (State.mode === 'scanning' || State.mode === 'cleaning') return;
  State.transition('scanning');

  // 重置 UI
  dom.result.style.display = 'none';
  dom.result.classList.remove('visible');
  dom.summary.style.display = 'none';
  dom.summary.classList.remove('visible');
  dom.categories.innerHTML = '';
  showProgress(true);
  setProgress(0, t('progress.scanning'));
  updateStatusBadge('scanning');

  updateActionBtn('scanning');

  try {
    // 先获取类别定义
    const categories = await window.electronAPI.getCategories();
    State.selected = new Set();

    // 渲染占位列表
    categories.forEach(cat => {
      const div = el('div', { className: 'category-item', id: 'cat-' + cat.id });
      div.appendChild(el('span', { className: 'category-icon', textContent: cat.icon }));
      const info = el('div', { className: 'category-info' });
      info.appendChild(el('div', { className: 'category-name', textContent: cat.name }));
      info.appendChild(el('div', { className: 'category-detail', textContent: t('scanning.status') }));
      div.appendChild(info);
      div.appendChild(el('span', { className: 'category-status scanning', textContent: '⏳ ' + t('scanning.status') }));
      dom.categories.appendChild(div);
    });

    // 监听真实进度
    const unsub = window.electronAPI.onScanProgress((progress) => {
      const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
      setProgress(pct, t('progress.scanning'));
      // 更新对应分类的状态
      const catEl = document.getElementById('cat-' + progress.category);
      if (catEl && progress.status === 'done') {
        // 将在 renderResults 中完整更新
      }
    });

    // 执行扫描
    const results = await window.electronAPI.scan();
    unsub();

    State.setResults(results);
    State.transition('scanned');
    setProgress(100, t('progress.scanDone'));
    setTimeout(() => setProgress(0, ''), 600);

    renderResults(results);
    updateSummaryUI();

    updateStatusBadge('scanned');
    updateActionBtn('scanned');

  } catch (err) {
    console.error('Scan failed:', err);
    setProgress(0, t('scan.failed'));
    State.transition('idle');
    updateStatusBadge('error');
    updateActionBtn('error');
  }
}

// ---- 渲染扫描结果（带复选框，安全 DOM）----
function renderResults(results) {
  dom.categories.innerHTML = '';

  results.forEach(item => {
    const div = el('div', { className: 'category-item' });

    // 复选框（仅可清理项可勾选）
    const canClean = item.status !== 'admin_required' && item.status !== 'clean' && item.status !== 'error' && item.status !== 'skipped' && (item.size > 0 || item.id === 'dns_cache');
    const cb = el('input', {
      type: 'checkbox',
      className: 'category-checkbox',
    });
    cb.checked = State.selected.has(item.id);
    if (!canClean) cb.disabled = true;
    cb.addEventListener('change', () => State.toggleSelected(item.id));
    div.appendChild(cb);

    div.appendChild(el('span', { className: 'category-icon', textContent: item.icon }));

    const info = el('div', { className: 'category-info' });
    info.appendChild(el('div', { className: 'category-name', textContent: item.name }));

    let statusClass, statusText, detail;
    if (item.status === 'admin_required') {
      statusClass = 'admin';
      statusText = t('admin.required');
      detail = t('admin.hint');
    } else if (item.status === 'error') {
      statusClass = 'failed';
      statusText = '❌ 错误';
      detail = '扫描出错，请重试';
    } else if (item.status === 'skipped') {
      statusClass = 'admin';
      statusText = '⏭️ 跳过';
      detail = '无法访问此位置';
    } else if (item.status === 'clean' || (item.size === 0 && item.id !== 'dns_cache' && item.id !== 'recycle_bin')) {
      statusClass = 'clean';
      statusText = t('clean.ok');
      detail = t('clean.noNeed');
    } else if (item.id === 'dns_cache') {
      statusClass = 'found';
      statusText = t('clean.flush');
      detail = t('clean.flushDesc');
    } else if (item.size > 0) {
      statusClass = 'found';
      statusText = formatSize(item.size);
      detail = formatFiles(item.files);
    } else {
      statusClass = 'clean';
      statusText = t('clean.ok');
      detail = t('clean.noNeed');
    }
    info.appendChild(el('div', { className: 'category-detail', textContent: detail }));
    div.appendChild(info);

    const statusSpan = el('span', { className: 'category-status ' + statusClass, textContent: statusText });
    div.appendChild(statusSpan);

    dom.categories.appendChild(div);
  });
}

// ---- 更新摘要 UI ----
function updateSummaryUI() {
  const selectedResults = State.results.filter(r => State.selected.has(r.id));
  const totalSize = selectedResults.reduce((s, r) => s + r.size, 0);

  if (totalSize > 0 && State.mode === 'scanned') {
    dom.summaryValue.textContent = formatSize(totalSize);
    dom.summary.style.display = 'block';
    dom.summary.classList.add('visible');
    dom.cleanBtn.disabled = false;
    dom.cleanBtn.textContent = t('clean.btn');
  } else if (State.mode === 'scanned') {
    dom.summary.style.display = 'none';
    dom.summary.classList.remove('visible');
  }
}

// ---- 清理 ----
async function startClean() {
  if (State.mode !== 'scanned') return;
  State.transition('cleaning');

  dom.cleanBtn.disabled = true;
  dom.cleanBtn.textContent = t('clean.btn.cleaning');
  dom.summary.style.display = 'none';
  dom.summary.classList.remove('visible');

  updateStatusBadge('cleaning');
  updateActionBtn('cleaning');

  showProgress(true);
  setProgress(0, t('progress.cleaning'));

  // 更新列表状态
  document.querySelectorAll('.category-item').forEach(item => {
    const statusSpan = item.querySelector('.category-status');
    if (statusSpan) {
      const txt = statusSpan.textContent;
      if (txt !== t('clean.ok') && txt !== t('admin.required')) {
        statusSpan.className = 'category-status cleaning';
        statusSpan.textContent = '🧹 ' + t('cleaning.status');
      }
    }
  });

  try {
    // 只发送选中的类别
    const toClean = State.results.filter(r => State.selected.has(r.id));

    const unsub = window.electronAPI.onCleanProgress((progress) => {
      const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
      setProgress(pct, t('progress.cleaning'));
    });

    const cleanResult = await window.electronAPI.clean(toClean);
    unsub();

    State.cleanResult = cleanResult;
    setProgress(100, t('progress.cleanDone'));

    // 渲染结果
    dom.resultValue.textContent = formatSize(cleanResult.totalFreed);
    dom.resultSub.textContent = t('result.cleaned') + formatFiles(cleanResult.totalDeleted);

    dom.resultDetails.innerHTML = '';
    cleanResult.details.forEach(d => {
      const row = el('div', { className: 'result-detail-item' });
      let cls, icon, stat;
      if (d.status === 'ok')          { cls = 'done'; icon = '✅'; stat = t('clean.done'); }
      else if (d.status === 'admin_required') { cls = 'skipped'; icon = '🛡️'; stat = t('admin.required'); }
      else if (d.status === 'clean')  { cls = 'skipped'; icon = '—'; stat = t('clean.noNeed'); }
      else                            { cls = 'failed'; icon = '❌'; stat = t('clean.failed'); }
      row.className = 'result-detail-item ' + cls;

      row.appendChild(el('span', { className: 'd-icon', textContent: icon }));
      row.appendChild(el('span', { className: 'd-name', textContent: d.name }));
      if (d.freed > 0) row.appendChild(el('span', { className: 'd-freed', textContent: formatSize(d.freed) }));
      row.appendChild(el('span', { className: 'd-status', textContent: stat }));

      dom.resultDetails.appendChild(row);
    });

    dom.result.style.display = 'block';
    dom.result.classList.add('visible');

    updateStatusBadge('cleaned');
    updateActionBtn('cleaned');

  } catch (err) {
    console.error('Clean failed:', err);
    setProgress(0, t('clean.failed'));
    State.transition('idle');
    updateStatusBadge('error');
    updateActionBtn('error');
    dom.cleanBtn.disabled = false;
    dom.cleanBtn.textContent = t('clean.btn');
  }
}

// ---- 重置 ----
function resetToIdle() {
  State.reset();
  dom.result.style.display = 'none';
  dom.result.classList.remove('visible');
  dom.summary.style.display = 'none';
  dom.summary.classList.remove('visible');
  dom.categories.innerHTML = '';
  showProgress(false);
  setProgress(0, '');
  updateStatusBadge('idle');
  updateActionBtn('idle');
}

// ---- UI 快捷更新 ----
function updateStatusBadge(mode) {
  dom.statusBadge.className = 'status-badge';
  dom.statusBadge.style.background = '';
  dom.statusBadge.style.color = '';

  const map = {
    idle:     { text: t('ready'),         cls: '' },
    scanning: { text: t('scanning'),      cls: 'scanning' },
    scanned:  { text: t('scan.complete'), cls: '' },
    cleaning: { text: t('cleaning'),      cls: 'cleaning' },
    cleaned:  { text: t('clean.complete'), cls: '' },
    error:    { text: t('scan.failed'),   cls: '' },
  };
  const cfg = map[mode] || map.idle;
  dom.statusBadge.textContent = cfg.text;
  if (cfg.cls) dom.statusBadge.classList.add(cfg.cls);
  if (mode === 'error') {
    dom.statusBadge.style.background = 'var(--danger-bg)';
    dom.statusBadge.style.color = 'var(--danger)';
  }
  if (mode === 'cleaned') {
    dom.statusBadge.style.background = 'var(--success-bg)';
    dom.statusBadge.style.color = 'var(--success)';
  }
}

function updateActionBtn(mode) {
  dom.actionBtn.className = 'action-btn';
  const map = {
    idle:     { label: t('action.scan'),     icon: '🔍', cls: '' },
    scanning: { label: t('action.scanning'), icon: '🔍', cls: 'scanning' },
    scanned:  { label: t('action.rescan'),   icon: '🔍', cls: '' },
    cleaning: { label: t('action.cleaning'), icon: '🧹', cls: 'cleaning' },
    cleaned:  { label: t('action.rescan'),   icon: '🔍', cls: '' },
    error:    { label: t('action.retry'),    icon: '🔍', cls: '' },
  };
  const cfg = map[mode] || map.idle;
  dom.btnLabel.textContent = cfg.label;
  dom.btnIcon.textContent = cfg.icon;
  if (cfg.cls) dom.actionBtn.classList.add(cfg.cls);

  // cleaned 时短暂显示"完成"
  if (mode === 'cleaned') {
    dom.actionBtn.classList.add('done');
    dom.btnLabel.textContent = t('action.done');
    dom.btnIcon.textContent = '✅';
    setTimeout(() => {
      dom.actionBtn.className = 'action-btn';
      dom.btnLabel.textContent = t('action.rescan');
      dom.btnIcon.textContent = '🔍';
    }, 1500);
  }
}

// ---- 事件绑定 ----
dom.actionBtn.addEventListener('click', () => {
  if (State.mode === 'idle' || State.mode === 'scanned' || State.mode === 'cleaned') startScan();
});
dom.cleanBtn.addEventListener('click', startClean);
dom.backBtn.addEventListener('click', resetToIdle);
