/*
 * Test tích hợp các tab Kế hoạch (Khách mời, Ngân sách, Dịch vụ, Timeline) và link xem công khai (docs/KE_HOACH_KE_HOACH_CUA_TOI.md).
 * Cần DB đã chạy đủ SQL trong docs/LICH_SU_THAY_DOI_DB.md.
 * Chạy: npm test (build rồi chạy trên bản dist). Dùng DB chung của nhóm: mọi dữ liệu test có email "test-gd2-…@example.com",
 * được dọn trước và sau khi chạy (kể cả khi test lỗi).
 */
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX || '2'; // Supabase chỉ cho 15 kết nối dùng chung cả nhóm
require('dotenv/config');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory, Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');
const { AllExceptionsFilter } = require('../dist/common/filters/all-exceptions.filter');
const { TransformResponseInterceptor } = require('../dist/common/interceptors/transform-response.interceptor');
const { PrismaService } = require('../dist/prisma/prisma.service');

const PREFIX = 'test-gd2-';
let app, prisma, base;
const u = {}; // owner (có đám cưới), outsider (chưa có)

async function cleanup() {
  const users = await prisma.users.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
  const ids = users.map((x) => x.id);
  if (!ids.length) return;
  const weddings = (await prisma.weddings.findMany({ where: { user_id: { in: ids } }, select: { id: true } })).map((w) => w.id);
  await prisma.notifications.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.wedding_share_links.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.timeline_tasks.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.wedding_extra_costs.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.wedding_category_budgets.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.plan_vendors.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.wedding_categories.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.weddings.deleteMany({ where: { id: { in: weddings } } });
  await prisma.users.deleteMany({ where: { id: { in: ids } } });
}

async function makeUser(key) {
  const tag = `${PREFIX}${key}-${randomUUID().slice(0, 8)}`;
  const row = await prisma.users.create({ data: { username: tag, email: `${tag}@example.com`, full_name: `Test ${key}`, password_hash: '-', role: 'Couple' } });
  const token = app.get(JwtService).sign({ sub: row.id, username: row.username, role: 'Couple' });
  u[key] = { id: row.id, token };
}

async function call(who, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${u[who].token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor(app.get(Reflector)));
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', 'localhost');
  prisma = app.get(PrismaService);
  await cleanup();

  for (const k of ['owner', 'outsider']) await makeUser(k);
  const cats = await fetch(`${base}/api/categories`).then((r) => r.json());
  const slug = cats.data[0].slug;
  const created = await call('owner', 'PUT', '/api/weddings/me', { groomName: 'Huy', brideName: 'Hà', date: '2030-05-01', guestCount: 200, budget: 300000000, categorySlugs: [slug] });
  assert.equal(created.status, 200, JSON.stringify(created.body));
});

after(async () => {
  try {
    if (prisma) await cleanup();
  } finally {
    if (app) await app.close();
  }
});

test('ngân sách: sửa tay, ghi đồng thời, đổi mức chi giữ ô sửa tay, cân đối, chi phí khác', async () => {
  const before = (await call('owner', 'GET', '/api/weddings/me/budget')).body.data;
  const c = before.categories[0];
  assert.equal(c.manual, false);
  assert.ok(['SAVING', 'BALANCED', 'PREMIUM'].includes(before.effectiveTier));
  const url = `/api/weddings/me/budget/categories/${c.categoryId}`;

  // Thiếu version: 400; version đúng: ghi; người sau dùng version cũ: 409, không ghi đè
  assert.equal((await call('owner', 'PUT', url, { amount: 400000000 })).body.error.code, 'VERSION_REQUIRED');
  const set = await call('owner', 'PUT', url, { amount: 400000000, version: before.version });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.deepEqual([set.body.data.categories[0].budget, set.body.data.categories[0].manual], [400000000, true]);
  const stale = await call('owner', 'PUT', url, { amount: 1, version: before.version });
  assert.deepEqual([stale.status, stale.body.error.code], [409, 'STALE_DATA']);

  // Đổi mức chi và tổng ngân sách: ô sửa tay giữ nguyên
  const w = (await call('owner', 'GET', '/api/weddings/me')).body.data;
  const patched = await call('owner', 'PATCH', '/api/weddings/me', { spendingTier: 'PREMIUM', budget: 500000000, tableCountOverride: 30, version: w.version });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  assert.deepEqual([patched.body.data.spendingTier, patched.body.data.tableCountOverride], ['PREMIUM', 30]);
  assert.equal((await call('owner', 'PATCH', '/api/weddings/me', { spendingTier: 'XA_XI', version: patched.body.data.version })).status, 400);
  let b = (await call('owner', 'GET', '/api/weddings/me/budget')).body.data;
  assert.deepEqual([b.tier, b.effectiveTier, b.tables.count, b.categories[0].budget], ['PREMIUM', 'PREMIUM', 30, 400000000]);
  // Lưu form thông tin đám cưới không xóa ô sửa tay của hạng mục còn chọn
  const w2 = (await call('owner', 'GET', '/api/weddings/me')).body.data;
  assert.equal((await call('owner', 'PUT', '/api/weddings/me', w2)).status, 200);
  b = (await call('owner', 'GET', '/api/weddings/me/budget')).body.data;
  assert.equal(b.categories[0].manual, true);

  // Bỏ ô sửa tay, đặt lại tất cả
  const cleared = await call('owner', 'DELETE', `${url}?version=${encodeURIComponent(b.version)}`);
  assert.equal(cleared.body.data.categories[0].manual, false);
  const reset = await call('owner', 'POST', '/api/weddings/me/budget/reset', { version: cleared.body.data.version });
  assert.equal(reset.status, 201);

  // Chi phí khác: thêm, sửa, xóa; tách khỏi chi phí theo gói
  const add = await call('owner', 'POST', '/api/weddings/me/extra-costs', { name: 'Thiệp cưới', amount: 3000000, version: reset.body.data.version });
  assert.equal(add.body.data.totals.extraCosts, 3000000);
  assert.equal(add.body.data.totals.remaining, add.body.data.totals.total - add.body.data.totals.packagesCost - 3000000);
  const id = add.body.data.extraCosts[0].id;
  const upd = await call('owner', 'PATCH', `/api/weddings/me/extra-costs/${id}`, { amount: 4000000, version: add.body.data.version });
  assert.equal(upd.body.data.totals.extraCosts, 4000000);
  const imp = await call('owner', 'POST', '/api/weddings/me/import/expenses', { rows: [{ title: 'Xe hoa', amount: '5tr' }, { title: 'Lỗi', amount: 'abc' }], version: upd.body.data.version });
  assert.deepEqual([imp.body.data.created, imp.body.data.invalid], [1, 1]);
  b = (await call('owner', 'GET', '/api/weddings/me/budget')).body.data;
  assert.equal(b.totals.extraCosts, 9000000);
  const del = await call('owner', 'DELETE', `/api/weddings/me/extra-costs/${id}?version=${encodeURIComponent(b.version)}`);
  assert.equal(del.body.data.totals.extraCosts, 5000000);

  // Cân đối: mọi ô đã sửa tay thì báo lỗi, không chia
  const reb = await call('owner', 'POST', '/api/weddings/me/budget/rebalance', { version: del.body.data.version });
  assert.equal(reb.status, 201, JSON.stringify(reb.body));
  assert.ok(reb.body.data.categories.every((x) => x.manual));
  const again = await call('owner', 'POST', '/api/weddings/me/budget/rebalance', { version: reb.body.data.version });
  assert.equal(again.body.error.code, 'REBALANCE_NOTHING_TO_SCALE');
});

test('chọn gói cho nhà cung cấp trong kế hoạch', async () => {
  const w = (await call('owner', 'GET', '/api/weddings/me')).body.data;
  const services = (await fetch(`${base}/api/services?category=${w.categorySlugs[0]}&pageSize=1`).then((r) => r.json())).data;
  const svc = (await fetch(`${base}/api/services/${services[0].id}`).then((r) => r.json())).data;
  const added = await call('owner', 'POST', '/api/weddings/me/plan-items', { serviceId: svc.id, packageId: svc.packages[0].id });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.deepEqual([added.body.data.package.id, added.body.data.package.source], [svc.packages[0].id, 'SELECTED']);
  const v = (await call('owner', 'GET', '/api/weddings/me/budget')).body.data.version;
  const bad = await call('owner', 'PATCH', `/api/weddings/me/plan-vendors/${svc.id}`, { packageId: '00000000-0000-0000-0000-000000000000', version: v });
  assert.equal(bad.body.error.code, 'PACKAGE_NOT_AVAILABLE');
  const planned = await call('owner', 'PATCH', `/api/weddings/me/plan-vendors/${svc.id}`, { packageId: null, version: v });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  assert.equal(planned.body.data.package.source, 'PLANNED');
  // version cũ bị từ chối
  assert.equal((await call('owner', 'PATCH', `/api/weddings/me/plan-vendors/${svc.id}`, { packageId: null, version: v })).body.error.code, 'STALE_DATA');
  assert.equal((await call('owner', 'DELETE', `/api/weddings/me/plan-items/${svc.id}`)).status, 200);
});

test('timeline: ghi chú, không ghi người viết hay người hoàn thành', async () => {
  const items = (await call('owner', 'GET', '/api/weddings/me/timeline')).body.data.items;
  const task = items.find((i) => i.kind === 'TASK');
  const r1 = await call('owner', 'PATCH', `/api/weddings/me/timeline/items/${task.id}`, { note: '  Gọi trước 2 ngày ', isDone: true });
  assert.equal(r1.status, 200);
  const t = r1.body.data.items.find((i) => i.id === task.id);
  assert.equal(t.note, 'Gọi trước 2 ngày');
  assert.ok(!('completedBy' in t));
  assert.equal((await call('owner', 'PATCH', `/api/weddings/me/timeline/items/${task.id}`, { note: 'x'.repeat(201) })).status, 400);
});

test('tài khoản chưa có đám cưới không đọc được dữ liệu của người khác', async () => {
  assert.equal((await call('outsider', 'GET', '/api/weddings/me')).body.data, null);
  for (const path of ['/api/weddings/me/timeline', '/api/weddings/me/plan-items', '/api/weddings/me/share-link']) {
    const r = await call('outsider', 'GET', path);
    assert.equal(r.status, 409, path);
  }
});

test('link công khai: chỉ trả tab được bật, tắt hoặc tạo lại thì link cũ trả 404', async () => {
  assert.equal((await call('owner', 'PUT', '/api/weddings/me/share-link', { enabled: true, tabs: [] })).status, 400);
  const link = (await call('owner', 'PUT', '/api/weddings/me/share-link', { enabled: true, tabs: ['overview', 'services'] })).body.data;
  const get = (path) => fetch(`${base}/api/public/plans/${link.token}${path}`);
  const head = await get('').then((r) => r.json());
  assert.deepEqual(head.data.tabs, ['overview', 'services']);
  assert.ok(!('members' in head.data));
  assert.equal((await get('/timeline')).status, 404);
  assert.equal((await get('/budget')).status, 404);
  const ov = await get('/overview').then((r) => r.json());
  assert.equal(ov.data.budget, null);
  assert.equal(ov.data.tasks, null);
  const sv = await get('/services').then((r) => r.json());
  assert.ok(sv.data.items.every((i) => i.price === null && !('order' in i)));

  await call('owner', 'PUT', '/api/weddings/me/share-link', { enabled: false });
  assert.equal((await get('')).status, 404);
  await call('owner', 'PUT', '/api/weddings/me/share-link', { enabled: true });
  const fresh = (await call('owner', 'POST', '/api/weddings/me/share-link/regenerate')).body.data;
  assert.notEqual(fresh.token, link.token);
  assert.equal((await get('')).status, 404);
  assert.equal((await fetch(`${base}/api/public/plans/${fresh.token}`)).status, 200);
});
