# Lịch sử thay đổi DB (Supabase dùng chung)

Mỗi lần chạy SQL lên Supabase của nhóm thì ghi thêm một mục vào **đầu** file này: ngày, file SQL, người chạy, kết quả, cách gỡ.
Quy trình như cũ: viết file trong `backend/prisma/sql/` (từ 30/10/2026: `backend/prisma/manual/`), chạy được nhiều lần không lỗi, không dùng `prisma migrate` hay `db push`.

---

## ⏳ CHƯA CHẠY: phân công việc, khách mời, mức chi tiêu và ngân sách theo giá gói

Code trên nhánh `Chie` đã dùng các cột và bảng này. Trước khi chạy, backend sẽ lỗi ở Tổng quan, Ngân sách, Khách mời, Dịch vụ (giá theo gói), gợi ý AI, So sánh và khi sửa việc trên Timeline. Chạy **đúng thứ tự** dưới đây. Mọi file chỉ thêm cột (cho phép rỗng hoặc có mặc định) và bảng mới, chạy lại nhiều lần vẫn an toàn.

| Thứ tự | File | Nội dung | Gỡ (nếu cần) |
|---|---|---|---|
| 1 | [`prisma/sql/2026-10-29-02-timeline-assign.sql`](../backend/prisma/sql/2026-10-29-02-timeline-assign.sql) | `timeline_tasks`: thêm `assignee`, `assignee_user_id`, `note`, `note_by`, `note_date`, `completed_by` | `ALTER TABLE public.timeline_tasks DROP COLUMN assignee, DROP COLUMN assignee_user_id, DROP COLUMN note, DROP COLUMN note_by, DROP COLUMN note_date, DROP COLUMN completed_by;` |
| 2 | [`prisma/sql/2026-10-29-04-guests.sql`](../backend/prisma/sql/2026-10-29-04-guests.sql) | Bảng mới `wedding_guests` | `DROP TABLE public.wedding_guests;` |
| 3 | [`prisma/manual/2026-10-30-01-budget-tiers.sql`](../backend/prisma/manual/2026-10-30-01-budget-tiers.sql) | `weddings.spending_tier`, `weddings.table_count_override`; `service_packages.unit` (kèm câu chuyển 29 gói nhà hàng ghi "/mâm" sang `mâm`); `plan_vendors.package_id`; bảng mới `wedding_category_budgets`, `wedding_extra_costs` | Câu ROLLBACK ở cuối file |
| 4 | [`prisma/manual/2026-10-30-02-invites-share.sql`](../backend/prisma/manual/2026-10-30-02-invites-share.sql) | Bảng mới `wedding_invites` (link mời), `wedding_share_links` (link xem công khai) | Câu ROLLBACK ở cuối file |
| 5 | [`prisma/manual/2026-10-30-03-package-availability.sql`](../backend/prisma/manual/2026-10-30-03-package-availability.sql) | Bảng mới `package_availability` (trạng thái gói theo ngày), `package_resources` (sảnh dùng chung) cho lịch khả dụng Trung tâm tiệc cưới ([availability.md](api/availability.md)). Chưa chạy thì chỉ phần lịch trả 503, trang khác không ảnh hưởng | Câu ROLLBACK ở cuối file |

File `prisma/sql/2026-10-29-03-budget.sql` (cột `wedding_categories.budget_amount`, bảng `wedding_expenses`) **đã bỏ, không chạy**: được thay bằng file số 3 theo đặc tả ngân sách mới. File SQL mới đặt ở `backend/prisma/manual/` theo yêu cầu ngày 30/10.

Cách chạy (trong `backend/`): `npx prisma db execute --file <đường dẫn file>`, hoặc dán từng file vào SQL Editor của Supabase. `schema.prisma` đã được sửa tay cho khớp, **không** cần `db:pull` (xem cảnh báo DB lệch ở mục dưới). Chạy xong thì sửa mục này thành ngày chạy, người chạy và kết quả.

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

**Bảng mới `wedding_members`** lưu người cùng lập kế hoạch một đám cưới:
- `role`: `Owner` (toàn quyền), `Editor` (sửa được), `Viewer` (chỉ xem, không xem chat).
- `relation`: `Bride`, `Groom`, `Relative`. Owner để trống.
- `display_name`: tên do owner đặt khi mời, tối đa 40 ký tự.
- `tabs`: các subtab của Kế hoạch người đó được xem (`overview`, `timeline`, `services`, `budget`, `guests`), ít nhất 1 tab. `NULL` nghĩa là xem tất cả; owner luôn là `NULL`.
- Mỗi tài khoản thuộc tối đa **một** đám cưới. Mỗi đám cưới có đúng **một** owner.
- 13 đám cưới đang có đã được thêm người tạo làm owner.
- `weddings.user_id` giữ nguyên và vẫn là owner. Hội thoại và đơn hàng vẫn gắn với owner.

Kế hoạch đầy đủ: [KE_HOACH_KE_HOACH_CUA_TOI.md](KE_HOACH_KE_HOACH_CUA_TOI.md).

### ⚠ Cần nhóm xử lý: DB đang lệch với `schema.prisma` trong repo

Sau khi chạy file trên, `npm run db:pull` cho thấy DB **khác repo ở nhiều chỗ không liên quan tới bảng mới**:

- **154 cột trên 24 bảng** trong repo đang là `NOT NULL`, nhưng trên DB đã thành nullable. Ví dụ `commissions.order_amount` và `users.email` đều có `is_nullable = YES`.
- Bảng `package_verifications` trên DB có thêm cột **`snapshot`**, repo chưa có.

Số cột thành nullable theo từng bảng:

| Bảng | Số cột | Bảng | Số cột |
|---|---|---|---|
| orders | 13 | order_items | 7 |
| vendor_profiles | 13 | users | 7 |
| consultation_requests | 10 | messages | 6 |
| weddings | 10 | order_revisions | 6 |
| commission_statements | 8 | vendor_documents | 6 |
| commissions | 8 | invoices | 5 |
| service_packages | 8 | package_albums | 5 |
| timeline_tasks | 8 | package_verifications | 4 |
| conversations | 7 | payments | 4 |
| notifications | 7 | search_histories | 4 |
| service_categories | 2 | vendor_verifications | 4 |
| favorite_vendors | 1 | plan_vendors | 1 |

**Cách đã xử lý lần này:** **không** lấy nguyên bản `db pull`. Nếu lấy, kiểu dữ liệu của gần như mọi bảng sẽ thành nullable và code của cả nhóm phải sửa theo. Thay vào đó, `schema.prisma` giữ như cũ và chỉ thêm tay model `wedding_members`.

**Cần một người trong nhóm xác nhận:**
1. Ai đã bỏ `NOT NULL` và thêm cột `snapshot`, và có cố ý không? Ví dụ có thể do dựng lại bảng bằng công cụ khác, hoặc khôi phục từ bản sao lưu.
2. Nếu **không cố ý**: viết một file SQL đặt lại `NOT NULL` theo đúng `schema.prisma` hiện tại. Trước đó phải kiểm tra DB không còn dòng nào chứa `NULL` ở các cột này.
3. Nếu **cố ý**: một người chạy `npm run db:pull`, sửa code theo kiểu mới rồi commit một lần, để cả nhóm cùng cập nhật.

Trong lúc chưa thống nhất, **đừng commit kết quả `db pull`** nếu chưa xem kỹ phần thay đổi.
