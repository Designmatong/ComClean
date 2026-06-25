/**
 * Cleaner 引擎基础测试
 * 运行方式: node test/cleaner.test.js
 */

const { Cleaner } = require('../backend/cleaner');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

async function run() {
  console.log('=== ComClean Cleaner Tests ===\n');

  const cleaner = new Cleaner();

  // ---- 类别定义 ----
  console.log('--- Categories ---');
  const cats = Cleaner.getCategories();
  assert(cats.length === 10, `10 categories, got ${cats.length}`);
  const ids = cats.map(c => c.id);
  assert(ids.includes('user_temp'), 'includes user_temp');
  assert(ids.includes('dns_cache'), 'includes dns_cache');
  assert(ids.includes('recycle_bin'), 'includes recycle_bin');

  // ---- 权限检测 ----
  console.log('\n--- Admin Detection ---');
  const isAdmin = await cleaner.isAdmin();
  assert(typeof isAdmin === 'boolean', `isAdmin returns boolean: ${isAdmin}`);

  // ---- 扫描 ----
  console.log('\n--- Scan ---');
  const results = await cleaner.scanAll(null);
  assert(results.length === 10, `scan returns 10 results, got ${results.length}`);

  for (const r of results) {
    assert(typeof r.id === 'string', `result has id: ${r.id}`);
    assert(typeof r.name === 'string', `result has name: ${r.name}`);
    assert(typeof r.size === 'number' && r.size >= 0, `size is non-negative: ${r.size}`);
    assert(typeof r.files === 'number' && r.files >= 0, `files is non-negative: ${r.files}`);
    assert(['ok', 'clean', 'skipped', 'error', 'admin_required'].includes(r.status),
      `valid status: ${r.status}`);
  }

  // ---- 清理（只清理安全项测试）----
  console.log('\n--- Clean ---');
  const toClean = results.filter(r => r.id === 'dns_cache');
  if (toClean.length > 0) {
    const summary = await cleaner.cleanAll(toClean, null);
    assert(typeof summary.totalFreed === 'number', 'totalFreed is number');
    assert(typeof summary.totalDeleted === 'number', 'totalDeleted is number');
    assert(Array.isArray(summary.details), 'details is array');
  }

  // ---- 进度回调 ----
  console.log('\n--- Progress Callback ---');
  let progressCalls = 0;
  await cleaner.scanAll((p) => {
    assert(typeof p.current === 'number', 'progress has current');
    assert(typeof p.total === 'number', 'progress has total');
    progressCalls++;
  });
  assert(progressCalls > 0, `progress callback called ${progressCalls} times`);

  // ---- 小结 ----
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
