# Thẻ đơn dịch vụ phía KHÁCH theo từng trạng thái

> Dựa trên `docs/database.md`, `docs/api/THE_DON_HANG.md` và `docs/CHOT_NGHIEP_VU_NCC.md`. Cập nhật 27/10/2026.
> Mục tiêu: **khách và NCC thấy cùng nội dung đơn, chỉ khác nút**.
> Kiểu dữ liệu dùng chung: `src/types/vendorOrder.ts` (7 trạng thái, nhiều hạng mục, DepositPercent, DepositDueDate, revisions, invoices, payment, cancelReason).
> Prototype hình: canvas "Thẻ đơn phía khách" (các khung 1–8 và Toàn luồng bước 1–10).

**Hai giai đoạn (đã chốt):**
- **Trước cọc** (Chờ thanh toán cọc, Chờ chỉnh sửa): khách có **Thanh toán cọc** và **Yêu cầu chỉnh sửa**, yêu cầu bao nhiêu lần cũng được.
- **Sau cọc** (Đã đặt cọc): khách **không có nút sửa hay hủy**. Muốn đổi hoặc hủy thì nhắn NCC trong chat; NCC thao tác trên đơn.

---

## 1. Nội dung thẻ (giống phía NCC, đọc trực tiếp từ đơn)

Thẻ nằm **bên trái** khung chat (tin của NCC gửi).

```
┌──────────────────────────────────────────────┐
│ Đơn dịch vụ DH26100009    [Chờ thanh toán cọc]│  ← Orders.OrderCode + badge (mục 2)
│ Studio Mây Wedding                            │  ← TÊN NCC (phía NCC thì là tên khách)
│                                               │
│ Gói chụp ảnh                     1.000.000đ   │  ← OrderItems: ItemName, Amount
│ 1 Gói × 1.000.000đ                            │     Quantity Unit × UnitPrice
│ Oneshot                            200.000đ   │     (tối đa 2 dòng, còn lại
│ 1 Gói × 200.000đ                              │      "và N hạng mục khác")
│ ─────────────────────────────────────────────│
│ Ngày thực hiện                   06/12/2027   │  ← EventDate
│ Tổng giá trị                      1.200.000đ   │  ← TotalAmount
│ Đã cập nhật: tổng 1.200.000đ → 1.700.000đ     │  ← chỉ ở thẻ gửi lại sau khi sửa
│ Đặt cọc (30%)                       400.000đ   │  ← DepositPercent, DepositAmount (KHÔNG ghi "qua VNPay")
│ Còn lại                             800.000đ   │  ← TotalAmount − DepositAmount (KHÔNG ghi "tiền mặt...")
│ Hạn đặt cọc        10:10 27/10 · còn 23 giờ   │  ← DepositDueDate, chỉ khi Chờ thanh toán cọc
│ Đã thanh toán cọc 400.000đ · 10:32 26/10      │  ← Payments.PaidDate, chỉ khi đã cọc
│ Ghi chú: ...                                  │  ← Note (ẩn nếu rỗng)
│ ┌──────────────────────────────────────────┐ │
│ │ Dòng gợi ý theo trạng thái (mục 2)       │ │  ← không nhắc lại số/ngày đã có ở trên
│ └──────────────────────────────────────────┘ │
│ [Nút chính]  Nút phụ · Nút phụ                │  ← theo trạng thái (mục 2)
└──────────────────────────────────────────────┘
```

**Khi NCC gửi lại đơn đã sửa:** thẻ cũ thu gọn thành một dòng *"Đơn DH… đã được cập nhật, xem bản mới nhất bên dưới"*; thẻ mới hiện đầy đủ, có dòng "Đã cập nhật: …" (tổng a → b, hoặc ngày a → b).

---

## 2. Theo từng trạng thái

| Trạng thái (`Orders.Status`) | Badge | Dòng gợi ý (khách thấy) | Nút chính | Nút phụ |
|---|---|---|---|---|
| **Draft** | — | **Khách không thấy thẻ** | — | — |
| **Pending** | Chờ thanh toán cọc (vàng) | *Không có ô gợi ý* (hạn đã hiện ở dòng "Hạn đặt cọc", đỏ khi < 6 giờ) | **Thanh toán cọc** | Yêu cầu chỉnh sửa · Xem chi tiết |
| **NeedRevision** | Chờ chỉnh sửa (cam) | "Đã gửi yêu cầu chỉnh sửa, chờ NCC cập nhật." + hộp nhắc lại: "Nội dung: Đổi số lượng · "Giảm còn 15 bàn nhé."" | — | Xem chi tiết |
| **Deposited** | Đã đặt cọc (xanh lá) | "Đã đặt cọc. Muốn đổi hoặc hủy đơn, bạn nhắn NCC ngay trong chat." | **Xem việc cần làm** (sang timeline) | Xem chi tiết |
| **Completed** | Hoàn thành (xanh đậm) | "Đơn đã hoàn thành." | — | Xem chi tiết · **Xem hóa đơn** (chỉ khi NCC đã xuất) |
| **Expired** | Đã hết hạn (xám) | "Đơn đã hết hạn đặt cọc. Nhắn NCC nếu bạn vẫn muốn đặt." | — | Xem chi tiết · Nhắn tin cho NCC (cuộn xuống ô nhập) |
| **Cancelled** | Đã hủy (đỏ nhạt) | Theo `cancelReason`: CUSTOMER_REQUEST → "Đơn đã hủy theo yêu cầu của bạn. Khoản cọc {DepositAmount} không được hoàn." · VENDOR_UNABLE → "NCC đã hủy đơn vì không thể thực hiện. NCC sẽ hoàn cọc cho bạn." | — | Xem chi tiết |

Ghi chú:
- **Không có nút Thanh toán cọc** khi Chờ chỉnh sửa hoặc đã hết hạn.
- **Khách không có nút Hủy đơn ở bất kỳ trạng thái nào.** Đơn chưa cọc tự hết hạn; đơn đã cọc do NCC hủy (chọn lý do) theo tin nhắn của khách.
- Đơn hết hạn hoặc đã hủy mà khách muốn đặt lại: NCC bấm "Tạo lại đơn" (mã mới), khách nhận thẻ đơn mới.
- Phần còn lại khách trả trực tiếp cho NCC ngoài hệ thống; không có nút thanh toán phần còn lại.
- Dữ liệu cũ có thể còn OrderRevisions AfterDeposit trạng thái Requested/Rejected: chỉ hiện trong lịch sử ở "Xem chi tiết", không hiện nhãn hay nút trên thẻ.

---

## 3. Các hộp thoại phía khách

### 3.1. Thanh toán cọc
Bấm **Thanh toán cọc** → hộp xác nhận: mã đơn, tên NCC, số tiền cọc, hạn → **Thanh toán** (VNPay khi có cấu hình; chế độ thanh toán thử khi chạy dev). Thành công: đơn chuyển Đã đặt cọc, chat có tin Giấy xác nhận cọc (mục 4).
Quá hạn cọc thì nút khóa, hiện "Đơn đã hết hạn đặt cọc".

### 3.2. Yêu cầu chỉnh sửa (CHỈ khi Chờ thanh toán cọc)
```
┌ Yêu cầu chỉnh sửa đơn DH26100009 ─────────────┐
│ Bạn muốn thay đổi gì?                          │
│ ☐ Đổi hạng mục      ☐ Đổi số lượng             │
│ ☐ Đổi ngày thực hiện ☐ Khác                    │
│ Nội dung chi tiết *                            │
│ [                                          ]   │
│                     [Hủy bỏ]  [Gửi yêu cầu]    │
└────────────────────────────────────────────────┘
```
- 4 ô chọn là tùy chọn; **nội dung chi tiết bắt buộc**.
- Giá trị lưu (`OrderRevisionChanges.ChangeType`): `Item`, `Quantity`, `EventDate`, `Other`.
- Gửi xong: OrderRevisions (BeforeDeposit, Requested); đơn chuyển **Chờ chỉnh sửa**, hạn cọc tạm dừng; chat có **1 tin hệ thống** (không thêm tin riêng của khách).

### 3.3. Xem chi tiết (giống hệt phía NCC)
Thông tin đơn · Bảng hạng mục đầy đủ · Lịch thanh toán 2 đợt (Đợt 1 cọc, phương thức VNPay + trạng thái; Đợt 2 phần còn lại, phương thức tiền mặt cho NCC, hạn = ngày thực hiện) · Lịch sử chỉnh sửa (ngày, trước/sau cọc, nội dung đổi, lời nhắn, tổng cũ → mới, trạng thái) · Lý do hủy (nếu có) · Chứng từ (Giấy xác nhận cọc, Hóa đơn cuối, mỗi loại nút Xem).

---

## 4. Các tin khác khách thấy trong chat

| Khi nào | Loại tin (`Messages.Type`) | Người gửi | Khách thấy |
|---|---|---|---|
| NCC gửi / gửi lại đơn / sửa sau cọc | `Order` | NCC | Thẻ đơn (mục 1) |
| Khách cọc thành công | `DepositReceipt` | Hệ thống | Thẻ "Giấy xác nhận cọc XNC…: đã nhận 400.000đ cho đơn DH…" + nút **Xem** |
| NCC xuất hóa đơn cuối | `FinalInvoice` | NCC | Thẻ "Hóa đơn HD… cho đơn DH…: tổng …, đã cọc …" + nút **Xem** |
| Khách yêu cầu sửa (trước cọc) | Tin hệ thống (Text) | Hệ thống | "Bạn đã yêu cầu chỉnh sửa đơn DH…: Đổi số lượng · "…"" |
| Đơn hết hạn | Tin hệ thống | Hệ thống | "Đơn DH… đã hết hạn đặt cọc." |
| NCC hủy đơn | Tin hệ thống | Hệ thống | "Studio Mây Wedding đã hủy đơn DH… · Lý do: Khách yêu cầu hủy" |
| Đơn hoàn thành | Tin hệ thống | Hệ thống | "Đơn DH… đã hoàn thành." |

Tin hệ thống là dòng nhỏ ở giữa khung chat. Cùng một sự kiện, chữ phía khách dùng "Bạn…", phía NCC dùng "Khách…".

---

## 5. Danh sách hội thoại phía khách

Mỗi hội thoại có badge theo đơn mới nhất với NCC đó: **Chờ cọc**, **Chờ chỉnh sửa**, **Đã cọc**, **Hoàn thành**, **Hết hạn**, **Đã hủy**. Chờ cọc sắp hết hạn (< 6 giờ) có chấm đỏ.

---

## 6. So với phía khách hiện tại: cần sửa

| # | Hiện tại | Cần đổi |
|---|---|---|
| 1 | Mô hình đơn 4 trạng thái (`SENT/REVISION_REQUESTED/PAID/CANCELLED`), 1 dòng "Gói dịch vụ", mã `#001` | Dùng DTO chung (`types/vendorOrder.ts`): 7 trạng thái, nhiều hạng mục, mã `DH…` |
| 2 | Badge "Đang chỉnh sửa", "Đã cọc" | "Chờ chỉnh sửa", "Đã đặt cọc"; thêm "Hoàn thành", "Đã hết hạn" |
| 3 | Thẻ thiếu tên NCC, hạng mục, % cọc, hạn cọc, ghi chú | Đủ như mục 1 và 2 |
| 4 | Nút "Xác nhận & thanh toán cọc" | "Thanh toán cọc" |
| 5 | Không có Xem chi tiết | Có ở mọi trạng thái (mục 3.3) |
| 6 | Sau cọc chỉ có "Xem việc cần làm" | **Giữ nguyên**: chỉ Xem việc cần làm + Xem chi tiết, thêm dòng gợi ý nhắn NCC |
| 7 | Completed hiện như "Đã cọc" | Badge Hoàn thành + Xem hóa đơn |
| 8 | Expired hiện như "Đã hủy" | Badge Đã hết hạn + gợi ý + Nhắn tin cho NCC |
| 9 | Form yêu cầu sửa: ô văn bản + 4 chip gợi ý chữ | 4 ô chọn (lưu ChangeType) + nội dung bắt buộc (mục 3.2) |
| 10 | Gửi lại đơn không thu gọn thẻ cũ | Thu gọn thẻ cũ, thẻ mới có "Đã cập nhật: …" |
| 11 | Giấy xác nhận cọc, hóa đơn hiện như chữ | Thẻ có nút Xem (mục 4) |
| 12 | Yêu cầu sửa gửi 2 tin (khách + hệ thống) | Chỉ 1 tin hệ thống |
