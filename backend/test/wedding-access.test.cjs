/*
 * Test tích hợp phân quyền thành viên đám cưới (GĐ 2, docs/KE_HOACH_KE_HOACH_CUA_TOI.md mục E).
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
const u = {}; // owner, editor, limited (editor chỉ xem Tổng quan + Timeline), viewer, outsider

async function cleanup() {
  const users = await prisma.users.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
  const ids = users.map((x) => x.id);
  if (!ids.length) return;
  const weddings = (await prisma.weddings.findMany({ where: { user_id: { in: ids } }, select: { id: true } })).map((w) => w.id);
  await prisma.notifications.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.wedding_invites.deleteMany({ where: { OR: [{ wedding_id: { in: weddings } }, { created_by: { in: ids } }, { used_by: { in: ids } }] } });
  await prisma.wedding_share_links.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.wedding_members.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { wedding_id: { in: weddings } }] } });
  await prisma.timeline_tasks.deleteMany({ where: { wedding_id: { in: weddings } } });
  await prisma.wedding_guests.deleteMany({ where: { wedding_id: { in: weddings } } });
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

/** POST nhưng chỉ đọc (không ghi DB), viewer được gọi. Thêm vào đây phải có lý do. */
const READ_ONLY_POSTS = new Set([
  '/api/weddings/me/ai-suggestions', // gợi ý AI: lọc và xếp hạng dịch vụ, không lưu gì
]);

/** Mọi endpoint ghi phía cặp đôi trên đám cưới, lấy từ router của app (endpoint mới thêm sau cũng được kiểm tra). */
function coupleWriteRoutes() {
  const stack = app.getHttpAdapter().getInstance().router.stack;
  const scope = /^\/api\/(weddings\/me|orders|payments)(\/|$)/; // chat (conversations) là phần của Chanh, chưa áp quyền thành viên
  const vendorOnly = /^\/api\/orders\/(?!:id\/revision-requests)/; // các route ghi /orders/* còn lại là của NCC (Roles Vendor)
  return stack
    .filter((l) => l.route && scope.test(l.route.path))
    .flatMap((l) => Object.keys(l.route.methods).map((m) => ({ method: m.toUpperCase(), path: l.route.path })))
    .filter((r) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method) && !(r.path.startsWith('/api/orders/') && vendorOnly.test(r.path)))
    .filter((r) => !(r.method === 'POST' && READ_ONLY_POSTS.has(r.path)));
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

  for (const k of ['owner', 'editor', 'limited', 'viewer', 'outsider', 'guest1', 'guest2', 'solo']) await makeUser(k);
  const cats = await fetch(`${base}/api/categories`).then((r) => r.json());
  const slug = cats.data[0].slug;
  const created = await call('owner', 'PUT', '/api/weddings/me', { groomName: 'Huy', brideName: 'Hà', date: '2030-05-01', guestCount: 200, budget: 300000000, categorySlugs: [slug] });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.data.access.role, 'OWNER');
  const weddingId = created.body.data.id;
  await prisma.wedding_members.createMany({
    data: [
      { wedding_id: weddingId, user_id: u.editor.id, role: 'Editor', relation: 'Bride' },
      { wedding_id: weddingId, user_id: u.limited.id, role: 'Editor', relation: 'Relative', tabs: ['overview', 'timeline'] },
      { wedding_id: weddingId, user_id: u.viewer.id, role: 'Viewer', relation: 'Relative' },
    ],
  });
});

after(async () => {
  try {
    if (prisma) await cleanup();
  } finally {
    if (app) await app.close();
  }
});

test('owner tạo đám cưới thì thành owner; thành viên đọc được cùng đám cưới', async () => {
  const mine = await call('owner', 'GET', '/api/weddings/me');
  for (const k of ['editor', 'viewer']) {
    const r = await call(k, 'GET', '/api/weddings/me');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.id, mine.body.data.id);
  }
  assert.equal((await call('viewer', 'GET', '/api/weddings/me')).body.data.access.role, 'VIEWER');
  assert.deepEqual((await call('limited', 'GET', '/api/weddings/me')).body.data.access.tabs, ['overview', 'timeline']);
});

test('viewer không ghi được ở mọi endpoint ghi', async () => {
  const routes = coupleWriteRoutes();
  assert.ok(routes.length >= 8, `chỉ tìm thấy ${routes.length} endpoint ghi`);
  for (const r of routes) {
    // Tham số đường dẫn: thành viên khác (không phải chính viewer) hoặc id ngẫu nhiên; guard phải chặn trước khi tìm bản ghi
    const path = r.path.replace(':userId', u.editor.id).replace(/:\w+/g, randomUUID());
    const res = await call('viewer', r.method, path, {});
    assert.equal(res.status, 403, `${r.method} ${r.path}: ${res.status} ${JSON.stringify(res.body)}`);
  }
});

test('editor sửa được kế hoạch nhưng không quản lý được thành viên', async () => {
  const put = await call('editor', 'PUT', '/api/weddings/me', { groomName: 'Huy', brideName: 'Hà', date: '2030-05-02', guestCount: 210, budget: 300000000, categorySlugs: (await call('owner', 'GET', '/api/weddings/me')).body.data.categorySlugs });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal((await call('editor', 'GET', '/api/conversations')).status, 200);
  assert.equal((await call('editor', 'PATCH', `/api/weddings/me/members/${u.viewer.id}`, { role: 'EDITOR' })).status, 403);
  assert.equal((await call('editor', 'DELETE', `/api/weddings/me/members/${u.viewer.id}`)).status, 403);
});

test('thành viên không được xem tab nào thì API của tab đó trả 403', async () => {
  assert.equal((await call('limited', 'GET', '/api/weddings/me/timeline')).status, 200);
  for (const [method, path] of [['GET', '/api/weddings/me/plan-items'], ['GET', '/api/orders']]) {
    const r = await call('limited', method, path);
    assert.equal(r.status, 403, path);
    assert.equal(r.body.error.code, 'TAB_FORBIDDEN', path);
  }
});

test('Tổng quan không trả số liệu của tab không được xem; Ngân sách, Khách mời trả 403', async () => {
  const ov = await call('limited', 'GET', '/api/weddings/me/overview');
  assert.equal(ov.status, 200);
  assert.ok(ov.body.data.tasks);
  assert.equal(ov.body.data.budget, null);
  assert.equal(ov.body.data.guests, null);
  for (const path of ['/api/weddings/me/budget', '/api/weddings/me/guests', '/api/weddings/me/export/guests.csv', '/api/weddings/me/export/budget.csv']) {
    const r = await call('limited', 'GET', path);
    assert.equal(r.status, 403, path);
  }
  const full = await call('owner', 'GET', '/api/weddings/me/overview');
  assert.ok(full.body.data.budget && full.body.data.guests);
});

test('khách mời: thêm, chặn trùng tên + bên, chưa mời thì chưa có phản hồi', async () => {
  const add = await call('editor', 'POST', '/api/weddings/me/guests', { fullName: 'Nguyễn An', side: 'GROOM', group: 'Bạn bè', partySize: 2 });
  assert.equal(add.status, 201);
  assert.equal(add.body.data.stats.total, 2);
  const dup = await call('editor', 'POST', '/api/weddings/me/guests', { fullName: 'nguyen an', side: 'GROOM' });
  assert.equal(dup.body.error.code, 'GUEST_DUPLICATE');
  const id = add.body.data.items[0].id;
  assert.equal((await call('editor', 'PATCH', `/api/weddings/me/guests/${id}`, { rsvp: 'ATTENDING' })).status, 400);
  const invited = await call('editor', 'PATCH', `/api/weddings/me/guests/${id}`, { isInvited: true, rsvp: 'ATTENDING' });
  assert.equal(invited.body.data.stats.attending, 2);
  // Bỏ "đã mời" thì phản hồi về chưa phản hồi
  const back = await call('editor', 'PATCH', `/api/weddings/me/guests/${id}`, { isInvited: false });
  assert.equal(back.body.data.items[0].rsvp, 'PENDING');
  const bulk = await call('editor', 'POST', '/api/weddings/me/guests/bulk', { names: ['Trần Bình', 'Lê Cường'], side: 'BRIDE', group: 'Gia đình' });
  assert.equal(bulk.body.data.stats.rows, 3);
});

test('nhập khách: dryRun không ghi, dòng lỗi bị bỏ qua, thay toàn bộ', async () => {
  const rows = [{ name: 'Phạm Dũng', side: 'Nhà trai' }, { name: 'Trần Bình', side: 'Nhà gái' }, { name: 'X', side: 'hàng xóm' }];
  const dry = await call('editor', 'POST', '/api/weddings/me/import/guests', { rows, dryRun: true });
  assert.deepEqual([dry.body.data.valid, dry.body.data.invalid, dry.body.data.created], [1, 2, 0]);
  assert.equal((await call('editor', 'GET', '/api/weddings/me/guests')).body.data.stats.rows, 3);
  const real = await call('editor', 'POST', '/api/weddings/me/import/guests', { rows });
  assert.equal(real.body.data.created, 1);
  const replace = await call('editor', 'POST', '/api/weddings/me/import/guests', { rows, mode: 'REPLACE' });
  assert.equal(replace.body.data.created, 2);
  assert.equal((await call('editor', 'GET', '/api/weddings/me/guests')).body.data.stats.rows, 2);
  const csv = await fetch(`${base}/api/weddings/me/export/guests.csv`, { headers: { authorization: `Bearer ${u.owner.token}` } });
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok((await csv.text()).startsWith('\uFEFFTên khách,Bên'));
});

test('ngân sách: sửa tay, ghi đồng thời, đổi mức chi giữ ô sửa tay, cân đối, chi phí khác', async () => {
  const before = (await call('editor', 'GET', '/api/weddings/me/budget')).body.data;
  const c = before.categories[0];
  assert.equal(c.manual, false);
  assert.ok(['SAVING', 'BALANCED', 'PREMIUM'].includes(before.effectiveTier));
  const url = `/api/weddings/me/budget/categories/${c.categoryId}`;

  // Thiếu version: 400; version đúng: ghi; người sau dùng version cũ: 409, không ghi đè
  assert.equal((await call('editor', 'PUT', url, { amount: 400000000 })).body.error.code, 'VERSION_REQUIRED');
  const set = await call('editor', 'PUT', url, { amount: 400000000, version: before.version });
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
  let b = (await call('editor', 'GET', '/api/weddings/me/budget')).body.data;
  assert.deepEqual([b.tier, b.effectiveTier, b.tables.count, b.categories[0].budget], ['PREMIUM', 'PREMIUM', 30, 400000000]);
  // Lưu form thông tin đám cưới không xóa ô sửa tay của hạng mục còn chọn
  const w2 = (await call('owner', 'GET', '/api/weddings/me')).body.data;
  assert.equal((await call('owner', 'PUT', '/api/weddings/me', { ...w2, access: undefined })).status, 200);
  b = (await call('editor', 'GET', '/api/weddings/me/budget')).body.data;
  assert.equal(b.categories[0].manual, true);

  // Bỏ ô sửa tay, đặt lại tất cả
  const cleared = await call('editor', 'DELETE', `${url}?version=${encodeURIComponent(b.version)}`);
  assert.equal(cleared.body.data.categories[0].manual, false);
  const reset = await call('editor', 'POST', '/api/weddings/me/budget/reset', { version: cleared.body.data.version });
  assert.equal(reset.status, 201);

  // Chi phí khác: thêm, sửa, xóa; tách khỏi chi phí theo gói
  const add = await call('editor', 'POST', '/api/weddings/me/extra-costs', { name: 'Thiệp cưới', amount: 3000000, version: reset.body.data.version });
  assert.equal(add.body.data.totals.extraCosts, 3000000);
  assert.equal(add.body.data.totals.remaining, add.body.data.totals.total - add.body.data.totals.packagesCost - 3000000);
  const id = add.body.data.extraCosts[0].id;
  const upd = await call('editor', 'PATCH', `/api/weddings/me/extra-costs/${id}`, { amount: 4000000, version: add.body.data.version });
  assert.equal(upd.body.data.totals.extraCosts, 4000000);
  const imp = await call('editor', 'POST', '/api/weddings/me/import/expenses', { rows: [{ title: 'Xe hoa', amount: '5tr' }, { title: 'Lỗi', amount: 'abc' }], version: upd.body.data.version });
  assert.deepEqual([imp.body.data.created, imp.body.data.invalid], [1, 1]);
  b = (await call('editor', 'GET', '/api/weddings/me/budget')).body.data;
  assert.equal(b.totals.extraCosts, 9000000);
  const del = await call('editor', 'DELETE', `/api/weddings/me/extra-costs/${id}?version=${encodeURIComponent(b.version)}`);
  assert.equal(del.body.data.totals.extraCosts, 5000000);

  // Cân đối: mọi ô đã sửa tay thì báo lỗi, không chia
  const reb = await call('editor', 'POST', '/api/weddings/me/budget/rebalance', { version: del.body.data.version });
  assert.equal(reb.status, 201, JSON.stringify(reb.body));
  assert.ok(reb.body.data.categories.every((x) => x.manual));
  const again = await call('editor', 'POST', '/api/weddings/me/budget/rebalance', { version: reb.body.data.version });
  assert.equal(again.body.error.code, 'REBALANCE_NOTHING_TO_SCALE');
});

test('chọn gói cho nhà cung cấp trong kế hoạch', async () => {
  const w = (await call('owner', 'GET', '/api/weddings/me')).body.data;
  const services = (await fetch(`${base}/api/services?category=${w.categorySlugs[0]}&pageSize=1`).then((r) => r.json())).data;
  const svc = (await fetch(`${base}/api/services/${services[0].id}`).then((r) => r.json())).data;
  const added = await call('editor', 'POST', '/api/weddings/me/plan-items', { serviceId: svc.id, packageId: svc.packages[0].id });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.deepEqual([added.body.data.package.id, added.body.data.package.source], [svc.packages[0].id, 'SELECTED']);
  let v = (await call('editor', 'GET', '/api/weddings/me/budget')).body.data.version;
  const bad = await call('editor', 'PATCH', `/api/weddings/me/plan-vendors/${svc.id}`, { packageId: '00000000-0000-0000-0000-000000000000', version: v });
  assert.equal(bad.body.error.code, 'PACKAGE_NOT_AVAILABLE');
  const planned = await call('editor', 'PATCH', `/api/weddings/me/plan-vendors/${svc.id}`, { packageId: null, version: v });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  assert.equal(planned.body.data.package.source, 'PLANNED');
  // version cũ bị từ chối
  assert.equal((await call('editor', 'PATCH', `/api/weddings/me/plan-vendors/${svc.id}`, { packageId: null, version: v })).body.error.code, 'STALE_DATA');
  // Viewer không chọn gói được
  v = (await call('editor', 'GET', '/api/weddings/me/budget')).body.data.version;
  assert.equal((await call('viewer', 'PATCH', `/api/weddings/me/plan-vendors/${svc.id}`, { packageId: null, version: v })).status, 403);
  assert.equal((await call('editor', 'DELETE', `/api/weddings/me/plan-items/${svc.id}`)).status, 200);
});

test('timeline: giao việc, ghi chú, người hoàn thành', async () => {
  const items = (await call('editor', 'GET', '/api/weddings/me/timeline')).body.data.items;
  const task = items.find((i) => i.kind === 'TASK');
  const r1 = await call('editor', 'PATCH', `/api/weddings/me/timeline/items/${task.id}`, { assignee: 'MEMBER', assigneeUserId: u.limited.id, note: '  Gọi trước 2 ngày ', isDone: true });
  assert.equal(r1.status, 200);
  const t = r1.body.data.items.find((i) => i.id === task.id);
  assert.deepEqual(t.assignee, { kind: 'MEMBER', userId: u.limited.id, name: 'Test limited' });
  assert.equal(t.note.text, 'Gọi trước 2 ngày');
  assert.equal(t.note.by.userId, u.editor.id);
  assert.equal(t.completedBy.userId, u.editor.id);
  assert.equal((await call('editor', 'PATCH', `/api/weddings/me/timeline/items/${task.id}`, { note: 'x'.repeat(201) })).status, 400);
  assert.equal((await call('editor', 'PATCH', `/api/weddings/me/timeline/items/${task.id}`, { assignee: 'MEMBER', assigneeUserId: u.outsider.id })).status, 404);
  const ov = (await call('owner', 'GET', '/api/weddings/me/overview')).body.data.tasks;
  assert.equal(ov.assignees.find((a) => a.userId === u.limited.id).done, 1);
});

test('owner đổi quyền và phần được xem; không để trống phần được xem', async () => {
  const empty = await call('owner', 'PATCH', `/api/weddings/me/members/${u.viewer.id}`, { tabs: [] });
  assert.equal(empty.status, 400);
  const ok = await call('owner', 'PATCH', `/api/weddings/me/members/${u.viewer.id}`, { tabs: ['budget'] });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.data.find((m) => m.userId === u.viewer.id).tabs, ['budget']);
  assert.equal((await call('viewer', 'GET', '/api/weddings/me/timeline')).status, 403);
  const owner = await call('owner', 'PATCH', `/api/weddings/me/members/${u.owner.id}`, { role: 'VIEWER' });
  assert.equal(owner.status, 409);
});

test('người ngoài đám cưới không đọc được dữ liệu', async () => {
  assert.equal((await call('outsider', 'GET', '/api/weddings/me')).body.data, null);
  for (const path of ['/api/weddings/me/timeline', '/api/weddings/me/plan-items', '/api/weddings/me/members', '/api/orders']) {
    const r = await call('outsider', 'GET', path);
    assert.equal(r.status, 409, path);
  }
  const removeOwner = await call('outsider', 'DELETE', `/api/weddings/me/members/${u.owner.id}`);
  assert.equal(removeOwner.status, 409);
});

test('lời mời: chỉ owner tạo được, nhận một lần, thu hồi và hết hạn thì bị từ chối', async () => {
  assert.equal((await call('editor', 'POST', '/api/weddings/me/invites', { relation: 'RELATIVE' })).status, 403);
  const inv = await call('owner', 'POST', '/api/weddings/me/invites', { relation: 'RELATIVE', displayName: 'Dì Hai', tabs: ['overview', 'guests'] });
  assert.equal(inv.status, 201, JSON.stringify(inv.body));
  assert.deepEqual([inv.body.data.role, inv.body.data.tabs], ['VIEWER', ['overview', 'guests']]);
  const token = inv.body.data.token;
  const pub = await fetch(`${base}/api/invites/${token}`).then((r) => r.json());
  assert.deepEqual([pub.data.status, pub.data.displayName], ['VALID', 'Dì Hai']);

  const ok = await call('guest1', 'POST', `/api/invites/${token}/accept`, {});
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const me = (await call('guest1', 'GET', '/api/weddings/me')).body.data;
  assert.deepEqual([me.access.role, me.access.tabs], ['VIEWER', ['overview', 'guests']]);
  assert.equal((await call('guest2', 'POST', `/api/invites/${token}/accept`, {})).body.error.code, 'INVITE_USED');

  const rev = (await call('owner', 'POST', '/api/weddings/me/invites', { relation: 'GROOM' })).body.data;
  assert.equal(rev.role, 'EDITOR');
  assert.equal((await call('owner', 'DELETE', `/api/weddings/me/invites/${rev.id}`)).status, 200);
  assert.equal((await call('guest2', 'POST', `/api/invites/${rev.token}/accept`, {})).body.error.code, 'INVITE_REVOKED');

  const exp = (await call('owner', 'POST', '/api/weddings/me/invites', { relation: 'RELATIVE' })).body.data;
  await prisma.wedding_invites.update({ where: { id: exp.id }, data: { expires_date: new Date(Date.now() - 1000) } });
  assert.equal((await call('guest2', 'POST', `/api/invites/${exp.token}/accept`, {})).body.error.code, 'INVITE_EXPIRED');
  assert.equal((await fetch(`${base}/api/invites/khong-phai-ma`)).status, 404);
});

test('nhận lời mời khi đang có kế hoạch riêng trống: hỏi trước, đồng ý thì bỏ kế hoạch riêng', async () => {
  const own = await call('solo', 'PUT', '/api/weddings/me', { groomName: 'A', brideName: 'B', date: '2031-01-01', guestCount: 100, budget: 100000000, categorySlugs: (await call('owner', 'GET', '/api/weddings/me')).body.data.categorySlugs });
  assert.equal(own.status, 200);
  const inv = (await call('owner', 'POST', '/api/weddings/me/invites', { relation: 'BRIDE' })).body.data;
  const ask = await call('solo', 'POST', `/api/invites/${inv.token}/accept`, {});
  assert.deepEqual([ask.status, ask.body.error.code], [409, 'OWN_PLAN_EXISTS']);
  const yes = await call('solo', 'POST', `/api/invites/${inv.token}/accept`, { leaveOwnPlan: true });
  assert.equal(yes.status, 201, JSON.stringify(yes.body));
  assert.equal(await prisma.weddings.count({ where: { id: own.body.data.id } }), 0);
  assert.equal((await call('solo', 'GET', '/api/weddings/me')).body.data.access.role, 'EDITOR');
  // Thành viên của kế hoạch khác thì phải rời trước
  const inv2 = (await call('owner', 'POST', '/api/weddings/me/invites', { relation: 'RELATIVE' })).body.data;
  assert.equal((await call('solo', 'POST', `/api/invites/${inv2.token}/accept`, {})).status, 201); // cùng kế hoạch: không đổi gì
  assert.equal((await call('owner', 'DELETE', `/api/weddings/me/invites/${inv2.id}`)).status, 200);
});

test('tối đa 10 link mời đang chờ', async () => {
  const pending = (await call('owner', 'GET', '/api/weddings/me/invites')).body.data.length;
  for (let i = pending; i < 10; i++) assert.equal((await call('owner', 'POST', '/api/weddings/me/invites', { relation: 'RELATIVE' })).status, 201);
  assert.equal((await call('owner', 'POST', '/api/weddings/me/invites', { relation: 'RELATIVE' })).body.error.code, 'INVITE_LIMIT');
});

test('link công khai: chỉ trả tab được bật, tắt hoặc tạo lại thì link cũ trả 404', async () => {
  assert.equal((await call('editor', 'PUT', '/api/weddings/me/share-link', { enabled: true })).status, 403);
  assert.equal((await call('owner', 'PUT', '/api/weddings/me/share-link', { enabled: true, tabs: [] })).status, 400);
  const link = (await call('owner', 'PUT', '/api/weddings/me/share-link', { enabled: true, tabs: ['overview', 'services'] })).body.data;
  const get = (path) => fetch(`${base}/api/public/plans/${link.token}${path}`);
  const head = await get('').then((r) => r.json());
  assert.deepEqual(head.data.tabs, ['overview', 'services']);
  assert.ok(head.data.members.every((m) => m.name && !('email' in m)));
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

test('thành viên tự rời được, owner thì không', async () => {
  assert.equal((await call('owner', 'DELETE', `/api/weddings/me/members/${u.owner.id}`)).status, 409);
  assert.equal((await call('limited', 'DELETE', `/api/weddings/me/members/${u.limited.id}`)).status, 200);
  assert.equal((await call('limited', 'GET', '/api/weddings/me')).body.data, null);
  // Rời kế hoạch thì bỏ các việc đang giao cho người đó
  const items = (await call('owner', 'GET', '/api/weddings/me/timeline')).body.data.items;
  assert.ok(!items.some((i) => i.assignee?.userId === u.limited.id));
});
