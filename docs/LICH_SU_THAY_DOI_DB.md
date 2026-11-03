# Lịch sử thay đổi DB (Supabase dùng chung)

Mỗi lần chạy SQL lên Supabase của nhóm thì ghi thêm một mục vào **đầu** file này: ngày, file SQL, người chạy, kết quả, cách gỡ.
Quy trình như cũ: viết file trong `backend/prisma/sql/` (từ 30/10/2026: `backend/prisma/manual/`), chạy được nhiều lần không lỗi, không dùng `prisma migrate` hay `db push`.

---

## ✅ 02/11/2026: ghi chú việc, khách mời, ngân sách theo giá gói, link xem kế hoạch, lịch khả dụng (mục 1–5)

- File (chạy đúng thứ tự, bằng `npx prisma db execute --file …`): `2026-10-29-02-timeline-notes.sql`, `2026-10-29-04-guests.sql`, `2026-10-30-01-budget-tiers.sql`, `2026-10-30-02-share-links.sql`, `2026-10-30-03-package-availability.sql`.
- Người chạy: Chi (qua Claude Code).
- Kết quả: cả 5 file chạy thành công. Có `timeline_tasks.note`; bảng `wedding_guests`, `wedding_category_budgets`, `wedding_extra_costs`, `wedding_share_links`, `package_availability`, `package_resources`; cột `weddings.spending_tier`, `weddings.table_count_override`, `service_packages.unit`, `plan_vendors.package_id`.
  Câu UPDATE của budget-tiers chuyển **30** gói sang `unit = 'mâm'` (29 gói đã duyệt + 1 gói Pending "Sảnh Trắng Tinh Khôi" của Mipec Place, đều thuộc "Trung tâm tổ chức sự kiện"); 179 gói còn lại là `gói`.
  Backend khởi động lại không còn cảnh báo `[DB] Chưa chạy SQL`. Test tích hợp `plan-tabs.test.cjs`: 6/7 qua; test "nhập khách" còn lỗi ở bước so CSV vì `fetch().text()` của Node bỏ BOM, không liên quan DB.
- Gỡ: câu ROLLBACK ở cuối từng file (theo thứ tự ngược lại).

---

## ✅ 02/11/2026: nơi tổ chức (`weddings.ward`)

- File: [`prisma/manual/2026-11-01-01-wedding-ward.sql`](../backend/prisma/manual/2026-11-01-01-wedding-ward.sql) (mục 6 bên dưới), chạy bằng `npx prisma db execute --file …`.
- Người chạy: Chi (qua Claude Code), theo yêu cầu để "Gợi ý cho bạn" xếp theo phường/xã.
- Kết quả: thêm cột `weddings.ward varchar(50)` cho phép rỗng và CHECK `ck_weddings_ward` (126 phường/xã). 16 đám cưới hiện có đều để trống, khách chọn ở form thông tin đám cưới. Backend khởi động lại thì không còn cảnh báo file này.
- Gỡ: `ALTER TABLE public.weddings DROP CONSTRAINT IF EXISTS ck_weddings_ward, DROP COLUMN IF EXISTS ward;`

---

## Danh sách file SQL (đã chạy đủ 02/11/2026)

Code trên nhánh `Chie` đã dùng các cột và bảng này. Chưa chạy thì backend vẫn khởi động (in cảnh báo `[DB] Chưa chạy SQL: …`), các trang vẫn xem được, chỉ thao tác cần cột/bảng mới trả 503 `DB_MIGRATION_PENDING`: ghi chú việc, Khách mời, các thao tác ghi ở Ngân sách (sửa tay, cân đối, đặt lại, chi phí khác, đổi gói, mức chi tiêu), link xem kế hoạch, lịch khả dụng, nơi tổ chức. Chạy **đúng thứ tự** dưới đây. Mọi file chỉ thêm cột (cho phép rỗng hoặc có mặc định) và bảng mới, chạy lại nhiều lần vẫn an toàn.

| Thứ tự | File | Nội dung | Gỡ (nếu cần) |
|---|---|---|---|
| 1 | [`prisma/sql/2026-10-29-02-timeline-notes.sql`](../backend/prisma/sql/2026-10-29-02-timeline-notes.sql) | `timeline_tasks.note` (ghi chú của việc, không ghi người viết) | `ALTER TABLE public.timeline_tasks DROP COLUMN note;` |
| 2 | [`prisma/sql/2026-10-29-04-guests.sql`](../backend/prisma/sql/2026-10-29-04-guests.sql) | Bảng mới `wedding_guests` | `DROP TABLE public.wedding_guests;` |
| 3 | [`prisma/manual/2026-10-30-01-budget-tiers.sql`](../backend/prisma/manual/2026-10-30-01-budget-tiers.sql) | `weddings.spending_tier`, `weddings.table_count_override`; `service_packages.unit` (kèm câu chuyển 29 gói nhà hàng ghi "/mâm" sang `mâm`); `plan_vendors.package_id`; bảng mới `wedding_category_budgets`, `wedding_extra_costs` | Câu ROLLBACK ở cuối file |
| 4 | [`prisma/manual/2026-10-30-02-share-links.sql`](../backend/prisma/manual/2026-10-30-02-share-links.sql) | Bảng mới `wedding_share_links` (link xem kế hoạch công khai, không cần đăng nhập) | Câu ROLLBACK ở cuối file |
| 5 | [`prisma/manual/2026-10-30-03-package-availability.sql`](../backend/prisma/manual/2026-10-30-03-package-availability.sql) | Bảng mới `package_availability` (trạng thái gói theo ngày), `package_resources` (sảnh dùng chung) cho lịch khả dụng Trung tâm tiệc cưới ([availability.md](api/availability.md)). Chưa chạy thì chỉ phần lịch trả 503, trang khác không ảnh hưởng | Câu ROLLBACK ở cuối file |
| 6 ✅ đã chạy 02/11/2026 | [`prisma/manual/2026-11-01-01-wedding-ward.sql`](../backend/prisma/manual/2026-11-01-01-wedding-ward.sql) | `weddings.ward` (phường/xã nơi tổ chức, CHECK 126 phường/xã của Hà Nội). Chưa chạy thì form vẫn lưu được, chỉ bỏ qua nơi tổ chức | Câu ROLLBACK ở cuối file |
| 7 ✅ đã chạy 02/11/2026 | [`prisma/manual/2026-11-02-01-budget-allocation.sql`](../backend/prisma/manual/2026-11-02-01-budget-allocation.sql) | `weddings.budget_preset` (mức chia, mặc định BALANCED), `weddings.custom_weights` (jsonb, tỷ lệ mức Tùy chỉnh), `weddings.own_venue`, `weddings.own_venue_cost` (tiệc tự lo ngoài nền tảng). Không có cột số tiền phân bổ. Chưa chạy thì tab Ngân sách dùng mức Cân bằng, không có tiệc tự lo | Câu ROLLBACK ở cuối file |
| 8 ✅ đã chạy 02/11/2026 | [`prisma/manual/2026-11-02-02-order-adjustments.sql`](../backend/prisma/manual/2026-11-02-02-order-adjustments.sql) | Bảng mới `order_adjustments` (yêu cầu đổi số khách của đơn tiệc đã cọc: số khách / số bàn cũ và mới, giá trị cũ và mới, cọc bổ sung, trạng thái); `orders.guest_count`, `orders.cancel_requested_date`, `orders.cancel_request_note` (khách yêu cầu hủy đơn đã cọc). Chưa chạy thì các tính năng này trả 503, trang khác không ảnh hưởng | Câu ROLLBACK ở cuối file |

Cách chạy (trong `backend/`): `npx prisma db execute --file <đường dẫn file>`, hoặc dán từng file vào SQL Editor của Supabase. `schema.prisma` đã được sửa tay cho khớp, **không** cần `db:pull`. Chạy xong thì sửa mục này thành ngày chạy, người chạy và kết quả.

---

## 29/10/2026 — Tạo bảng `wedding_members`

| | |
|---|---|
| File | [`backend/prisma/sql/2026-10-29-01-wedding-members.sql`](../backend/prisma/sql/2026-10-29-01-wedding-members.sql) |
| Người chạy | Claude Code, theo yêu cầu của chủ nhánh `Chie` |
| Cách chạy | `npx prisma db execute --file prisma/sql/2026-10-29-01-wedding-members.sql` (trong `backend/`) |
| Kết quả | Thành công. Đã kiểm tra: số dòng `Owner` bằng số đám cưới, mỗi owner trùng `weddings.user_id`, RLS đã bật |
| Ảnh hưởng tới code đang chạy | Không có. Chỉ thêm bảng mới, không sửa hay xóa bảng cũ |
| Gỡ (nếu cần) | `DROP TABLE public.wedding_members;` |

**Không dùng nữa (02/11/2026):** đã bỏ tính năng nhiều người cùng lập kế hoạch, chỉ còn chia sẻ link xem công khai. Code và `schema.prisma` không còn đọc bảng `wedding_members`; bảng vẫn nằm trên DB. Muốn xóa hẳn thì chạy câu gỡ ở bảng trên (báo nhóm trước) rồi ghi một mục mới vào đầu file này.

### DB lệch với `schema.prisma` (đã xử lý 01/11/2026)

Lúc chạy file trên, DB có 154 cột đã thành nullable và cột `package_verifications.snapshot` mà repo chưa có. Khi gộp nhánh `Chanh` vào `Chie` (01/11/2026), `schema.prisma` đã theo đúng DB (các cột nullable, có `snapshot`) và code đã sửa theo, nên không cần đặt lại `NOT NULL`.
