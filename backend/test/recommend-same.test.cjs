/* Hàm đề xuất So sánh ở backend và frontend phải giống hệt (docs/api/compare.md). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
/** Bỏ chú thích đầu file và đuôi ".ts" ở đường dẫn import (khác nhau có chủ ý giữa hai bên) */
const body = (s) => s.replace(/^\/\*[\s\S]*?\*\/\n/, '').replace("from './recommend.config.ts'", "from './recommend.config'");

test('recommend.ts giống hệt giữa backend và frontend', () => {
  assert.equal(body(read('backend/src/modules/compare/recommend.ts')), body(read('frontend/src/features/compare/recommend.ts')));
});

test('recommend.config.ts giống hệt giữa backend và frontend', () => {
  assert.equal(body(read('backend/src/modules/compare/recommend.config.ts')), body(read('frontend/src/features/compare/recommend.config.ts')));
});
