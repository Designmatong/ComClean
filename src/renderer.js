// === State ===
let scanResults = [];
let isScanning = false;
let isCleaning = false;

// === DOM References ===
const $ = id => document.getElementById(id);
const actionBtn = $('actionBtn');
const btnLabel = $('btnLabel');
const btnIcon = $('btnIcon');
const progressArea = $('progressArea');
const progressFill = $('progressFill');
const progressText = $('progressText');
const categories = $('categories');
const summary = $('summary');
const summaryValue = $('summaryValue');
const cleanBtn = $('cleanBtn');
const result = $('result');
const resultValue = $('resultValue');
const resultSub = $('resultSub');
const resultDetails = $('resultDetails');
const backBtn = $('backBtn');
const statusBadge = $('statusBadge');
const adminWarning = $('adminWarning');
const adminBtn = $('adminBtn');
const closeBtn = $('closeBtn');
const minBtn = $('minBtn');

// === Title Bar Controls ===
closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());
minBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());

// === Utility ===
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

// === Admin Check ===
(async () => {
  try {
    const isAdmin = await window.electronAPI.checkAdmin();
    if (!isAdmin) {
      adminWarning.style.display = 'flex';
    }
  } catch (e) {
    console.log('Admin check skipped:', e.message);
  }
})();

adminBtn.addEventListener('click', async () => {
  adminBtn.disabled = true;
  adminBtn.textContent = '请确认...';
  try {
    await window.electronAPI.restartAdmin();
  } catch (e) {
    adminBtn.disabled = false;
    adminBtn.textContent = '重新启动';
  }
});

// === Scan ===
async function startScan() {
  if (isScanning || isCleaning) return;
  isScanning = true;

  // Reset UI
  result.style.display = 'none';
  result.classList.remove('visible');
  summary.style.display = 'none';
  summary.classList.remove('visible');
  categories.innerHTML = '';
  progressArea.classList.add('visible');
  progressFill.style.width = '0%';
  statusBadge.textContent = '\uD83D\uDD0D 扫描中...';
  statusBadge.className = 'status-badge scanning';

  // Button
  actionBtn.className = 'action-btn scanning';
  btnLabel.textContent = '扫描中';
  btnIcon.textContent = '\uD83D\uDD0D';

  try {
    // Stub categories for immediate feedback
    const stubItems = [
      { id: 'user_temp', icon: '\uD83D\uDCC1', name: '用户临时文件' },
      { id: 'system_temp', icon: '\u2699\uFE0F', name: '系统临时文件' },
      { id: 'recycle_bin', icon: '\u267B\uFE0F', name: '回收站' },
      { id: 'thumb_cache', icon: '\uD83D\uDDBC\uFE0F', name: '缩略图缓存' },
      { id: 'browser_cache', icon: '\uD83C\uDF10', name: '浏览器缓存' },
      { id: 'recent_items', icon: '\uD83D\uDCC4', name: '最近文档记录' },
      { id: 'dns_cache', icon: '\uD83C\uDF0D', name: 'DNS缓存' },
      { id: 'wer_reports', icon: '\u26A0\uFE0F', name: 'Windows错误报告' },
      { id: 'dx_cache', icon: '\uD83C\uDFAE', name: 'DirectX着色器缓存' },
      { id: 'delivery_opt', icon: '\uD83D\uDCE6', name: 'Delivery Optimization' },
    ];

    // Show stub scanning state
    stubItems.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'category-item';
      div.id = 'cat-' + cat.id;
      div.innerHTML = '<span class="category-icon">' + cat.icon + '</span><div class="category-info"><div class="category-name">' + cat.name + '</div><div class="category-detail">扫描中...</div></div><span class="category-status scanning">\u23F3 扫描中</span>';
      categories.appendChild(div);
    });

    // Animate progress
    const timer = setInterval(() => {
      const w = parseFloat(progressFill.style.width) || 0;
      if (w < 85) {
        progressFill.style.width = Math.min(w + Math.random() * 8, 85) + '%';
        progressText.textContent = '正在扫描系统垃圾文件...';
      }
    }, 400);

    // Actual scan
    const results = await window.electronAPI.scan();
    scanResults = results;

    clearInterval(timer);
    progressFill.style.width = '100%';
    progressText.textContent = '扫描完成！';
    setTimeout(() => { progressFill.style.width = '0%'; }, 600);

    // Render
    renderResults(results);

    const totalSize = results.reduce((s, r) => s + r.size, 0);
    const totalFiles = results.reduce((s, r) => s + r.files, 0);

    if (totalSize > 0) {
      summaryValue.textContent = formatSize(totalSize);
      summary.style.display = 'block';
      summary.classList.add('visible');
      cleanBtn.disabled = false;
      cleanBtn.innerHTML = '\uD83E\uDDF9 一键清理';
    }

    statusBadge.textContent = '\u2705 扫描完成';
    statusBadge.className = 'status-badge';
    actionBtn.className = 'action-btn';
    btnLabel.textContent = '重新扫描';
    btnIcon.textContent = '\uD83D\uDD0D';
    isScanning = false;

  } catch (err) {
    console.error('Scan failed:', err);
    progressText.textContent = '扫描失败，请重试';
    statusBadge.innerHTML = '\u274C 扫描失败';
    statusBadge.className = 'status-badge';
    statusBadge.style.background = 'var(--danger-bg)';
    statusBadge.style.color = 'var(--danger)';
    actionBtn.className = 'action-btn';
    btnLabel.textContent = '重新扫描';
    isScanning = false;
  }
}

function renderResults(results) {
  categories.innerHTML = '';
  let foundAny = false;

  results.forEach(item => {
    const div = document.createElement('div');
    div.className = 'category-item';

    let statusClass, statusText, detail;

    if (item.status === 'admin_required') {
      statusClass = 'admin';
      statusText = '\uD83D\uDEE1\uFE0F 需管理员';
      detail = '需要管理员权限';
    } else if (item.status === 'clean' || (item.size === 0 && item.id !== 'dns_cache' && item.id !== 'recycle_bin')) {
      statusClass = 'clean';
      statusText = '\u2705 干净';
      detail = '无需清理';
    } else if (item.id === 'dns_cache') {
      statusClass = 'found';
      statusText = '\uD83D\uDCA8 可刷新';
      detail = '刷新DNS解析缓存';
      foundAny = true;
    } else if (item.size > 0) {
      statusClass = 'found';
      statusText = formatSize(item.size);
      detail = formatFiles(item.files);
      foundAny = true;
    } else {
      statusClass = 'clean';
      statusText = '\u2705 干净';
      detail = '已清理或无文件';
    }

    div.innerHTML = '<span class="category-icon">' + item.icon + '</span><div class="category-info"><div class="category-name">' + item.name + '</div><div class="category-detail">' + detail + '</div></div><span class="category-status ' + statusClass + '">' + statusText + '</span>';
    categories.appendChild(div);
  });
}

// === Clean ===
async function startClean() {
  if (isCleaning || isScanning) return;
  isCleaning = true;

  cleanBtn.disabled = true;
  cleanBtn.textContent = '\u23F3 清理中...';
  summary.style.display = 'none';
  summary.classList.remove('visible');

  statusBadge.innerHTML = '\uD83E\uDDF9 清理中...';
  statusBadge.className = 'status-badge cleaning';

  actionBtn.className = 'action-btn cleaning';
  btnLabel.textContent = '清理中';
  btnIcon.textContent = '\uD83E\uDDF9';

  progressArea.classList.add('visible');
  progressFill.style.width = '0%';
  progressText.textContent = '正在清理垃圾文件...';

  // Update category statuses
  document.querySelectorAll('.category-item').forEach(item => {
    const statusSpan = item.querySelector('.category-status');
    if (statusSpan) {
      const txt = statusSpan.textContent;
      if (txt !== '\u2705 干净' && txt !== '\uD83D\uDEE1\uFE0F 需管理员') {
        statusSpan.className = 'category-status cleaning';
        statusSpan.textContent = '\uD83E\uDDF9 清理中';
      }
    }
  });

  try {
    const timer = setInterval(() => {
      const w = parseFloat(progressFill.style.width) || 0;
      if (w < 85) {
        progressFill.style.width = Math.min(w + Math.random() * 10, 85) + '%';
      }
    }, 300);

    const cleanResult = await window.electronAPI.clean(scanResults);

    clearInterval(timer);
    progressFill.style.width = '100%';

    const freed = cleanResult.totalFreed;
    const deleted = cleanResult.totalDeleted;

    resultValue.textContent = formatSize(freed);
    resultSub.textContent = '共清理 ' + formatFiles(deleted);

    // Detail per category
    resultDetails.innerHTML = '';
    cleanResult.details.forEach(d => {
      const div = document.createElement('div');
      let cls, icon, stat;
      if (d.status === 'ok') { cls = 'done'; icon = '\u2705'; stat = '已清理'; }
      else if (d.status === 'admin_required') { cls = 'skipped'; icon = '\uD83D\uDEE1\uFE0F'; stat = '需管理员'; }
      else if (d.status === 'clean') { cls = 'skipped'; icon = '\u2014'; stat = '无需清理'; }
      else { cls = 'failed'; icon = '\u274C'; stat = '失败'; }
      div.className = 'result-detail-item ' + cls;
      div.innerHTML = '<span class="d-icon">' + icon + '</span><span class="d-name">' + d.name + '</span>' + (d.freed > 0 ? '<span class="d-freed">' + formatSize(d.freed) + '</span>' : '') + '<span class="d-status">' + stat + '</span>';
      resultDetails.appendChild(div);
    });

    result.style.display = 'block';
    result.classList.add('visible');

    progressText.textContent = '清理完成！';
    statusBadge.innerHTML = '\u2728 清理完成';
    statusBadge.className = 'status-badge';
    statusBadge.style.background = 'var(--success-bg)';
    statusBadge.style.color = 'var(--success)';

    actionBtn.className = 'action-btn done';
    btnLabel.textContent = '已完成';
    btnIcon.textContent = '\u2705';
    setTimeout(() => {
      actionBtn.className = 'action-btn';
      btnLabel.textContent = '重新扫描';
      btnIcon.textContent = '\uD83D\uDD0D';
    }, 1500);

    isCleaning = false;

  } catch (err) {
    console.error('Clean failed:', err);
    progressText.textContent = '清理失败，请重试';
    statusBadge.innerHTML = '\u274C 清理失败';
    statusBadge.className = 'status-badge';
    statusBadge.style.background = 'var(--danger-bg)';
    statusBadge.style.color = 'var(--danger)';
    actionBtn.className = 'action-btn';
    btnLabel.textContent = '重试';
    cleanBtn.disabled = false;
    cleanBtn.innerHTML = '\uD83E\uDDF9 一键清理';
    isCleaning = false;
  }
}

// === Events ===
actionBtn.addEventListener('click', startScan);
cleanBtn.addEventListener('click', startClean);
backBtn.addEventListener('click', () => {
  result.style.display = 'none';
  result.classList.remove('visible');
  summary.style.display = 'none';
  summary.classList.remove('visible');
  categories.innerHTML = '';
  progressArea.classList.remove('visible');
  progressFill.style.width = '0%';
  statusBadge.innerHTML = '\uD83D\uDFE2 就绪';
  statusBadge.className = 'status-badge';
  statusBadge.style.background = '';
  statusBadge.style.color = '';
  actionBtn.className = 'action-btn';
  btnLabel.textContent = '开始扫描';
  btnIcon.textContent = '\uD83D\uDD0D';
});
