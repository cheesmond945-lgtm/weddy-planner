# Thuật toán sinh ngày cho timeline cưới

> Bản chuẩn dùng cho mục 3.2.2.2 của báo cáo. Nội dung khớp với mã nguồn trên nhánh `Chanh` (đã gồm Bước 0, Bước 7 và cờ Gấp theo `created_date`). Chỗ nào mô tả cũ khác với mã nguồn, tài liệu này viết theo mã nguồn; các điểm khác được liệt kê ở Phụ lục B. Số dòng đối chiếu nằm ở Phụ lục A.

## 1. Tổng quan

Timeline của một đám cưới gồm hai lớp việc:

- **Timeline khung**: sinh từ bộ 31 việc mẫu cố định trong mã nguồn. Mỗi việc mẫu thuộc một trong ba loại: *Tự làm* (cặp đôi tự lo), *Chọn nhà cung cấp* (lọc, hỏi giá, đi xem, thử) và *Mốc chốt* (xác nhận đơn và đặt cọc). Việc Tự làm có thể là việc chung hoặc thuộc một dịch vụ; việc Chọn nhà cung cấp và Mốc chốt luôn thuộc một trong sáu dịch vụ: trung tâm tiệc cưới, chụp ảnh và quay phim, trang phục, trang trí, trang điểm, hoa cưới. Mỗi việc mẫu có độ lệch so với ngày cưới. Timeline khung được sinh tự động ngay khi cặp đôi tạo đám cưới: nút "Tạo timeline khung" chính là nút lưu thông tin đám cưới.
- **Timeline chi tiết**: sinh cho từng đơn sau khi đơn được đặt cọc, theo các mốc thời gian mà nhà cung cấp đã khai báo cho gói dịch vụ (số ngày trước, đúng hoặc sau ngày thực hiện của đơn), cộng thêm một việc thanh toán phần còn lại.

Hệ thống **tính hạn** ở các thời điểm sau:

| Thời điểm | Lớp | Việc được tính |
|---|---|---|
| Tạo đám cưới | Khung | Toàn bộ việc khung của các dịch vụ đã chọn |
| Thêm dịch vụ (sửa thông tin đám cưới) | Khung | Chỉ các việc chưa có của dịch vụ mới |
| Đổi ngày cưới (cặp đôi đổi, hoặc nhà hàng đổi ngày tiệc của đơn tiệc trùng ngày cưới) | Khung | Mọi việc khung chưa xong |
| Đơn được đặt cọc | Chi tiết | Toàn bộ việc của các gói gắn với đơn và việc thanh toán |
| Nhà cung cấp đổi ngày thực hiện của đơn | Chi tiết | Việc của đơn chưa xong và chưa chốt lịch |
| Nhà cung cấp đổi gói của đơn đã cọc | Chi tiết | Việc của gói mới thêm |

Hạn của từng việc được **lưu** vào cơ sở dữ liệu (cột `scheduled_date`). Ba thông tin sau **không lưu** mà tính lại mỗi lần hiển thị: trạng thái *Quá hạn*, cờ *Gấp* và nhãn *Ưu tiên k*.

## 2. Bảng ký hiệu

Mọi ngày đều được quy về số nguyên (số ngày kể từ 01/01/1970) để cộng trừ trực tiếp; "hôm nay" luôn lấy theo giờ Việt Nam.

| Ký hiệu | Ý nghĩa | Cách xác định |
|---|---|---|
| I | Ngày tính hạn ("hôm nay" của lần tính) | Ngày (giờ VN) tại thời điểm hệ thống tính hạn: lúc tạo đám cưới, thêm dịch vụ hoặc đổi ngày cưới. Với cờ Gấp, I của mỗi việc khung là `created_date` của dòng đó (xem Bước 6) |
| W | Ngày cưới | `weddings.wedding_date` |
| L | Thời gian chuẩn bị | L = W − I (ngày) |
| L₁ | Số ngày có thể xếp việc | L₁ = L − 1 (từ ngày mai I + 1 đến W) |
| d | Số ngày trước ngày cưới theo mẫu | d = −offset của việc mẫu; việc sau cưới có d âm (Cảm ơn khách: d = −7) |
| d′ | Số ngày trước ngày cưới sau khi dồn lịch | Công thức Bước 2 |
| K | Ngưỡng giữ nguyên | K = min(60; max(⌊L₁/2⌋; L₁ − 20)); không xác định khi L₁ ≥ 270 |
| 270 | Độ lệch xa nhất của bộ mẫu (`FRAME_MAX_OFFSET`) | Hằng số; việc xa nhất là "Thống nhất với hai gia đình", d = 270 |
| n | Số việc trước cưới | Số việc khung có d > 0 sau khi lọc theo dịch vụ, trước khi gộp; không tính "Cảm ơn khách" |
| ρ | Mật độ việc | ρ = n ÷ L₁; L₁ ≤ 0 thì ρ = +∞ |
| N | Hạn của một việc (dạng ngày) | Giá trị trung gian qua từng bước; giá trị cuối cùng là hạn được lưu |
| E | Ngày thực hiện của đơn | `orders.event_date` |
| D | Ngày đặt cọc | Ngày thanh toán cọc (giờ VN); chưa có ngày thanh toán thì lấy hôm nay |
| x | Số ngày trước E của một việc chi tiết | x = −`offset_days` của việc nhà cung cấp khai báo (chỉ với việc trước E) |
| x′ | x sau khi co | x′ = round(x × scale) |
| lo | Ngày sớm nhất của việc chi tiết | lo = D + 2 |
| xmax | Việc chi tiết xa nhất trước E | xmax = max(0; các x của đơn) |
| scale | Hệ số co của việc chi tiết | scale = min(1; (E − lo) ÷ xmax) khi xmax > 0 và E − lo > 0; ngược lại scale = 1 |
| round(·) | Làm tròn nửa lên | round(x) = ⌊x + 0,5⌋ (đối số luôn không âm nên trùng với làm tròn thông thường) |

Chữ L cũng được dùng ở chương ngân sách với nghĩa khác (xem đề xuất ở Phụ lục C).

## 3. Phân mức theo thời gian chuẩn bị

| L | Mức | Ảnh hưởng |
|---|---|---|
| L > 270 | Cưới xa | Không dồn lịch (L₁ ≥ 270) |
| 81 ≤ L ≤ 270 | Bình thường | Có dồn lịch; cờ Gấp chỉ bật khi việc bị kẹp về ngày sàn hoặc rơi vào ngày cưới |
| 21 ≤ L ≤ 80 | Gấp | Có dồn lịch; cờ Gấp bật thêm khi việc bị thu gọn quá 50% |
| 1 ≤ L ≤ 20 | Rất gấp | Như mức Gấp |
| L ≤ 0 | (không hợp lệ) | Bị chặn: hàm tính ném lỗi, không cho lưu ngày cưới không sau hôm nay |

## 4. Thuật toán timeline khung

Bước 1 đến Bước 6 là công thức gốc. Bước 0 và Bước 7 là quy tắc bổ sung, chạy trước và sau công thức gốc mà không thay đổi công thức đó.

### Bước 0. Lọc việc theo dịch vụ và gộp việc theo mật độ

1. **Lọc**: giữ mọi việc chung (Tự làm không thuộc dịch vụ nào) và mọi việc của các dịch vụ cặp đôi đã chọn.
2. **Tính mật độ**: n là số việc trước cưới còn lại; ρ = n ÷ L₁.
3. **Gộp khi ρ > 1**: với mỗi dịch vụ đã chọn, toàn bộ việc Chọn nhà cung cấp và Mốc chốt của dịch vụ đó được thay bằng một việc "Chọn và chốt [dịch vụ]" (ví dụ "Chọn và chốt trung tâm tiệc cưới"). Việc gộp:
   - giữ mã, thứ tự và d của Mốc chốt, nên vẫn tự hoàn thành khi đơn của dịch vụ đó được đặt cọc;
   - không ưu tiên cuối tuần và không thuộc nhóm "không thu gọn";
   - không lưu gợi ý vào cơ sở dữ liệu. Lúc hiển thị, nếu việc chưa xong, hệ thống lấy các bước con từ bộ mẫu theo chuỗi của dịch vụ và hiện dạng "Gợi ý: bước 1 → bước 2 → … → Chốt", kèm nút "Gợi ý {dịch vụ}". Ghi chú (`note`) của việc để nguyên cho cặp đôi tự ghi.
4. **ρ ≤ 1**: không gộp. Việc Tự làm không bao giờ bị gộp.

Một dịch vụ được nhận ra là **đã gộp** nhờ mã việc, không dựa vào tên: timeline có mã Mốc chốt của dịch vụ nhưng không còn mã Chọn nhà cung cấp nào của dịch vụ đó (kể cả dòng cặp đôi đã xoá).

- **Thêm dịch vụ sau**: mật độ được xét lại tại thời điểm thêm, với I = ngày thêm và n tính trên toàn bộ dịch vụ đang chọn. Dịch vụ mới được gộp hay không tuỳ kết quả đó. Việc đã có không bị tính lại. Dịch vụ đã gộp từ trước không bị sinh lại việc Chọn nhà cung cấp.
- **Đổi ngày cưới**: giữ nguyên trạng thái gộp như lúc sinh (không gộp thêm, không tách ra), chỉ tính lại hạn.

### Bước 1. Hạn gốc

N = W − d. Việc sau cưới (d < 0) có N = W + |d| và không qua Bước 2 đến Bước 5.

### Bước 2. Dồn lịch

Khi thời gian chuẩn bị ngắn hơn bộ mẫu (L₁ < 270), các việc xa ngày cưới được nén lại cho vừa khoảng từ ngày mai đến ngày cưới:

- K = min(60; max(⌊L₁/2⌋; L₁ − 20))
- d′ = round(K + (d − K) × (L₁ − K) / (270 − K)) nếu d > K
- d′ = d nếu d ≤ K, nếu L₁ ≥ 270, hoặc nếu việc thuộc nhóm không thu gọn ("Rà soát cuối" d = 3, "Cảm ơn khách" d = −7)
- N = W − d′

Trong đó round(x) = ⌊x + 0,5⌋.

**Ý nghĩa của K**: các việc gần ngày cưới (d ≤ K) giữ đúng khoảng cách như mẫu. Các việc xa hơn được ánh xạ tuyến tính từ đoạn (K; 270] vào đoạn (K; L₁], nên việc xa nhất (d = 270) rơi đúng vào d′ = L₁, tức ngày mai I + 1. Theo L₁ có ba trường hợp:

| L₁ | K | Diễn giải |
|---|---|---|
| L₁ ≥ 80 | 60 | Giữ nguyên 60 ngày cuối như mẫu; chỉ nén các việc xa hơn 60 ngày |
| 40 ≤ L₁ < 80 | L₁ − 20 | Giữ nguyên các việc có d ≤ L₁ − 20; mọi việc xa hơn bị nén vào 20 ngày đầu |
| L₁ < 40 | ⌊L₁/2⌋ | Chia đôi: nửa sau giữ nguyên, nửa đầu chứa toàn bộ việc xa |

(L₁ ≥ 270 thì K không xác định và không dồn lịch.)

### Bước 3. Ngày sàn

Không việc trước cưới nào có hạn trước ngày mai: nếu N < I + 1 thì N = I + 1 và việc được đánh dấu *bị kẹp*. Vì d′ ≤ L₁ với mọi d ≤ 270, trên thực tế chỉ việc không thu gọn "Rà soát cuối" (d = 3) bị kẹp, khi L ≤ 3.

### Bước 4. Thứ tự trong chuỗi

Với mỗi dịch vụ, các việc Chọn nhà cung cấp rồi Mốc chốt được xét theo thứ tự trong bộ mẫu. Việc sau phải muộn hơn việc trước ít nhất 1 ngày: đặt lo = max(I + 1; N của việc trước + 1). Nếu N < lo thì N = lo (việc bị *đẩy theo thứ tự*). Việc Tự làm không thuộc chuỗi nên không qua bước này.

### Bước 5. Ưu tiên cuối tuần

Chỉ áp dụng cho việc Chọn nhà cung cấp có cờ ưu tiên cuối tuần (các việc cần đi gặp hoặc thử: đi xem sảnh, thử món, gặp tư vấn studio, thử váy và vest, chọn mẫu và đo, makeup thử) và chỉ khi việc không bị đẩy ở Bước 4:

- Nếu N đã là thứ Bảy hoặc Chủ nhật: giữ nguyên.
- Nếu N là thứ Hai đến thứ Sáu: lùi về **Chủ nhật** liền trước (N − thứ trong tuần, với Chủ nhật = 0). Mã nguồn không chọn thứ Bảy.
- Chỉ lùi, không bao giờ dời muộn hơn hạn. Nếu ngày Chủ nhật đó sớm hơn lo của Bước 4 (trước ngày mai, hoặc trước hoặc trùng việc liền trước trong chuỗi) thì bỏ qua, giữ ngày thường.

### Bước 6. Cờ Gấp

Cờ Gấp của một việc trước cưới bật khi thoả một trong ba điều kiện:

1. việc bị kẹp về ngày sàn ở Bước 3; hoặc
2. đám cưới ở mức Gấp hoặc Rất gấp **và** mức thu gọn > 50%; hoặc
3. hạn rơi vào hoặc sau ngày cưới (N ≥ W).

**Mức thu gọn** = (d − (W − N)) ÷ d, với N là hạn sau Bước 5, nghĩa là khoảng cách thực tế tới ngày cưới đã tính cả Bước 3, 4 và 5. Khi không bị kẹp, đẩy hay dời thì W − N = d′ và mức thu gọn = (d − d′) ÷ d. Ngưỡng là **lớn hơn hẳn** 50%. Ở mức Cưới xa và Bình thường, việc dù bị nén nhiều cũng không mang cờ Gấp vì điều kiện 2.

**I dùng cho cờ Gấp**: cờ Gấp không lưu mà tính lại lúc hiển thị, với đúng I đã dùng để tính hạn của từng việc. Quy ước: `created_date` của việc khung là **lần cuối hệ thống tính hạn**:

- lúc sinh và lúc thêm dịch vụ, cơ sở dữ liệu ghi `created_date = now()`;
- lúc đổi ngày cưới, mọi việc khung chưa xong được tính lại thì đặt `created_date = now()`, cùng lệnh cập nhật hạn;
- cặp đôi tự sửa hạn không đổi `created_date`.

Khi hiển thị, các việc khung được nhóm theo ngày `created_date` (giờ VN). Mỗi nhóm chạy toàn bộ thuật toán một lần với W hiện tại và trạng thái gộp hiện tại, rồi lấy cờ Gấp của đúng các việc trong nhóm. Việc đã xong không hiện cờ Gấp.

**Gấp khác Quá hạn**: Gấp phản ánh việc *bị ép thời gian* lúc lập lịch và không phụ thuộc ngày xem. *Quá hạn* là trạng thái theo ngày xem: việc chưa xong và hạn < hôm nay (không áp dụng cho việc thanh toán phần còn lại). Ngoài ra có trạng thái *Sắp đến hạn* khi còn 0 đến 2 ngày. Một việc có thể Gấp mà chưa quá hạn, hoặc quá hạn mà không Gấp.

### Bước 7. Ưu tiên, sắp lại việc gộp và chặn trên

**7.1. Nhãn Ưu tiên.** Tính lúc hiển thị với L = W − hôm nay (giờ VN, không phải I lúc sinh), chỉ khi 0 < L ≤ 80. Thứ tự các dịch vụ:

- Trung tâm tiệc cưới luôn là Ưu tiên 1 (nếu được chọn).
- Các dịch vụ còn lại theo mức chia ngân sách (`budget_preset`):

| budget_preset | Mức chia | Thứ tự sau tiệc |
|---|---|---|
| VISUAL | Ưu tiên hình ảnh | trang phục → trang điểm → chụp ảnh → trang trí → hoa cưới |
| SPACE | Ưu tiên không gian | trang trí → hoa cưới → trang phục → trang điểm → chụp ảnh |
| BALANCED | Cân bằng | chụp ảnh → trang phục → trang trí → trang điểm → hoa cưới |
| CUSTOM | Tùy chỉnh | Theo tỷ lệ % trong `custom_weights`, cao trước; bằng nhau thì theo thứ tự Cân bằng; chưa có tỷ lệ thì dùng Cân bằng |

Không có dữ liệu ngân sách thì dùng Cân bằng. Chỉ các dịch vụ đã chọn được đánh số, liên tục 1, 2, 3… Nhãn gắn trên các việc Chọn nhà cung cấp và Mốc chốt (kể cả việc gộp) chưa xong của dịch vụ.

**7.2. Sắp lại hạn của việc gộp.** Chỉ khi có từ hai việc gộp trở lên. Lấy tập hạn (kèm cờ Gấp) mà Bước 1–6 đã tính cho các việc gộp, sắp tăng dần, rồi giao lần lượt cho các dịch vụ theo thứ tự ưu tiên ở 7.1: hạn sớm nhất cho dịch vụ ưu tiên cao nhất. Cờ Gấp đi theo hạn. Nếu hạn được giao không muộn hơn hạn của việc liền trước thì lùi thành hạn liền trước + 1 ngày, nhưng không quá W − 1; vượt W − 1 thì để trùng ngày với việc liền trước. Thứ tự ở bước này dùng mức chia ngân sách tại lúc tính hạn.

**7.3. Chặn trên.** Chỉ áp dụng khi W − 1 ≥ I + 1:

- mọi việc trước cưới có hạn > W − 1 được đặt về W − 1;
- "Rà soát cuối" phải là việc trước cưới muộn nhất: nếu có việc muộn hơn thì đặt hạn Rà soát cuối bằng hạn muộn nhất đó (tối đa W − 1); được phép trùng ngày;
- không việc nào bị đẩy sớm hơn I + 1, việc sau cưới không đổi, cờ Gấp không bị thay đổi ở bước này.

Khi W − 1 < I + 1 (cưới ngày mai, L = 1), Bước 7.3 bỏ qua và giữ hành vi của Bước 1–6: mọi việc trước cưới dồn về I + 1 = W và mang cờ Gấp. Bước 0 vẫn gộp vì ρ = +∞.

Hạn sau Bước 7 là hạn được lưu.

## 5. Thuật toán timeline chi tiết

Timeline chi tiết được sinh **cho đơn** khi đơn được đặt cọc. Đầu vào là các việc nhà cung cấp khai báo cho những gói gắn với đơn (mỗi việc có số ngày lệch so với ngày thực hiện E), cùng D, E và I = hôm nay. Mỗi đơn chỉ được sinh một lần: đơn đã có bất kỳ việc nào thì không sinh thêm.

1. lo = D + 2: việc chi tiết không sớm hơn hai ngày sau ngày đặt cọc.
2. xmax = max(0; x của các việc trước E).
3. scale = min(1; (E − lo) ÷ xmax) khi xmax > 0 và E − lo > 0; các trường hợp khác scale = 1.
4. Hạn từng việc theo loại mốc:

| Loại mốc | Điều kiện | Hạn |
|---|---|---|
| Trước ngày thực hiện | offset < 0, E − lo > 0 | x′ = round(x × scale); N = min(E − x′; E − 1); nếu N < lo thì N = lo |
| Trước ngày thực hiện, không còn chỗ | offset < 0, E − lo ≤ 0 | N = max(I + 1; D + 1), đánh dấu gấp và rút ngắn |
| Đúng ngày thực hiện | offset = 0 | N = E |
| Sau ngày thực hiện | offset > 0 | N = E + offset |
| Thanh toán phần còn lại | luôn có, mỗi đơn một việc | N = E (hạn chót; trả sớm lúc nào cũng được) |

- **Ngày sàn** của việc trước E là lo = D + 2. Việc trước E không rơi đúng vào E (tối đa E − 1) khi còn chỗ.
- **xmax = 0** (không có việc trước E): scale = 1, các việc đúng ngày và sau ngày tính như bảng trên.
- **E − lo ≤ 0** (đặt cọc quá sát ngày thực hiện): mọi việc trước E dồn về max(I + 1; D + 1).
- Thứ tự các việc giữ đúng thứ tự gói và thứ tự nhà cung cấp khai báo.

**Tính lại khi nhà cung cấp đổi ngày thực hiện:** chạy lại cùng công thức với E mới cho các việc chưa xong và chưa chốt lịch. Việc đã chốt trước E mà ngày chốt nằm sau E mới thì được đánh dấu để nhà cung cấp chốt lại với khách. Việc thanh toán dời theo E mới.

**Đổi gói của đơn đã cọc:** việc của gói mới trùng tên với việc của gói bỏ đi thì giữ dòng cũ cùng tiến độ; việc mới hoàn toàn được tính hạn bằng cùng công thức trên.

Đổi ngày cưới không làm thay đổi việc chi tiết, vì các việc này neo theo E của đơn.

## 6. Ví dụ minh hoạ

Các bảng dưới đây do chính các hàm thuần trong mã nguồn tính (`keepThreshold`, `mergeChains`, `planFrame`, `planTimeline`), với I = 15/11/2026. Cột B1 đến B5 là hạn sau từng bước của công thức gốc. Cột B7 là hạn được lưu sau Bước 7. Ô **in đậm** là ô thay đổi so với cột liền trước. Cột Ưu tiên hiển thị như khi xem đúng ngày 15/11/2026.

### Ví dụ 1. L = 181, 6 dịch vụ (không gộp, không nhãn)

I = 15/11/26, W = 15/05/27, L = 181, L₁ = 180, K = 60, mức Bình thường. Dịch vụ: 6, n = 30, ρ = 30 ÷ 180 = 0,17 → không gộp. L > 80 nên không có nhãn Ưu tiên. Mức Bình thường nên không việc nào Gấp dù bị nén tới 33%.

| STT | Việc (sau Bước 0) | d | d′ | B1: W − d | B2: W − d′ | B3: sàn I + 1 | B4: thứ tự | B5: cuối tuần | B7: hạn lưu | Gấp | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Thống nhất với hai gia đình: ngân sách, quy mô tiệc… | 270 | **180** | 18/08/26 | **16/11/26** | 16/11/26 | 16/11/26 | 16/11/26 | 16/11/26 |  |  |
| 2 | Lập danh sách khách sơ bộ, chọn phong cách và màu c… | 250 | **169** | 07/09/26 | **27/11/26** | 27/11/26 | 27/11/26 | 27/11/26 | 27/11/26 |  |  |
| 3 | Lọc và hỏi giá 3–5 nhà hàng: lịch trống, giá bàn, p… | 235 | **160** | 22/09/26 | **06/12/26** | 06/12/26 | 06/12/26 | 06/12/26 | 06/12/26 |  |  |
| 4 | Đi xem sảnh để đánh giá: sức chứa, sân khấu, bãi xe… | 205 | **143** | 22/10/26 | **23/12/26** | 23/12/26 | 23/12/26 | **20/12/26** | 20/12/26 |  |  |
| 5 | Lọc và hỏi giá 3–5 studio chụp ảnh & quay phim: pho… | 200 | **140** | 27/10/26 | **26/12/26** | 26/12/26 | 26/12/26 | 26/12/26 | 26/12/26 |  |  |
| 6 | Thử món theo thực đơn dự kiến, góp ý khẩu vị; xin b… | 190 | **134** | 06/11/26 | **01/01/27** | 01/01/27 | 01/01/27 | **27/12/26** | 27/12/26 |  |  |
| 7 | Gặp tư vấn studio: xem album in thật, phim mẫu; tra… | 185 | **131** | 11/11/26 | **04/01/27** | 04/01/27 | 04/01/27 | **03/01/27** | 03/01/27 |  |  |
| 8 | Chốt nhà hàng: so sánh, xác nhận đơn và đặt cọc | 180 | **129** | 16/11/26 | **06/01/27** | 06/01/27 | 06/01/27 | 06/01/27 | 06/01/27 |  |  |
| 9 | Chốt chụp ảnh & quay phim: so sánh, xác nhận đơn và… | 170 | **123** | 26/11/26 | **12/01/27** | 12/01/27 | 12/01/27 | 12/01/27 | 12/01/27 |  |  |
| 10 | Quyết định thuê hay may đo, số bộ cần; lọc và hỏi c… | 160 | **117** | 06/12/26 | **18/01/27** | 18/01/27 | 18/01/27 | 18/01/27 | 18/01/27 |  |  |
| 11 | Lọc và hỏi giá đơn vị decor: gửi thông tin sảnh, ý … | 150 | **111** | 16/12/26 | **24/01/27** | 24/01/27 | 24/01/27 | 24/01/27 | 24/01/27 |  |  |
| 12 | Đi thử váy, vest để đánh giá cửa hàng | 145 | **109** | 21/12/26 | **26/01/27** | 26/01/27 | 26/01/27 | **24/01/27** | 24/01/27 |  |  |
| 13 | Chọn mẫu chính thức, đo số đo; hỏi rõ số lần sửa, p… | 135 | **103** | 31/12/26 | **01/02/27** | 01/02/27 | 01/02/27 | **31/01/27** | 31/01/27 |  |  |
| 14 | Chốt trang phục: so sánh, xác nhận đơn và đặt cọc | 130 | **100** | 05/01/27 | **04/02/27** | 04/02/27 | 04/02/27 | 04/02/27 | 04/02/27 |  |  |
| 15 | Xem công trình decor thực tế, so sánh báo giá và hạ… | 128 | **99** | 07/01/27 | **05/02/27** | 05/02/27 | 05/02/27 | 05/02/27 | 05/02/27 |  |  |
| 16 | Gửi concept, màu chủ đạo, ảnh tham khảo; chốt danh … | 120 | **94** | 15/01/27 | **10/02/27** | 10/02/27 | 10/02/27 | 10/02/27 | 10/02/27 |  |  |
| 17 | Lọc và hỏi giá chuyên viên makeup: ảnh khách thật, … | 120 | **94** | 15/01/27 | **10/02/27** | 10/02/27 | 10/02/27 | 10/02/27 | 10/02/27 |  |  |
| 18 | Chốt decor: xác nhận đơn và đặt cọc | 115 | **91** | 20/01/27 | **13/02/27** | 13/02/27 | 13/02/27 | 13/02/27 | 13/02/27 |  |  |
| 19 | Makeup thử hoặc xem video thực tế để đánh giá tay n… | 105 | **86** | 30/01/27 | **18/02/27** | 18/02/27 | 18/02/27 | **14/02/27** | 14/02/27 |  |  |
| 20 | Chốt makeup: so sánh, xác nhận đơn và đặt cọc | 95 | **80** | 09/02/27 | **24/02/27** | 24/02/27 | 24/02/27 | 24/02/27 | 24/02/27 |  |  |
| 21 | Chọn và mua nhẫn cưới | 85 | **74** | 19/02/27 | **02/03/27** | 02/03/27 | 02/03/27 | 02/03/27 | 02/03/27 |  |  |
| 22 | Lọc tiệm hoa, xem mẫu, hỏi hoa theo mùa và báo giá | 65 | **63** | 11/03/27 | **13/03/27** | 13/03/27 | 13/03/27 | 13/03/27 | 13/03/27 |  |  |
| 23 | Thiết kế, chọn mẫu và đặt in thiệp cưới | 60 | 60 | 16/03/27 | 16/03/27 | 16/03/27 | 16/03/27 | 16/03/27 | 16/03/27 |  |  |
| 24 | Gửi tiệm ảnh váy và màu decor; chọn mẫu hoa cầm tay… | 55 | 55 | 21/03/27 | 21/03/27 | 21/03/27 | 21/03/27 | 21/03/27 | 21/03/27 |  |  |
| 25 | Chốt hoa cưới: xác nhận đơn và đặt cọc | 45 | 45 | 31/03/27 | 31/03/27 | 31/03/27 | 31/03/27 | 31/03/27 | 31/03/27 |  |  |
| 26 | Đăng ký kết hôn | 40 | 40 | 05/04/27 | 05/04/27 | 05/04/27 | 05/04/27 | 05/04/27 | 05/04/27 |  |  |
| 27 | Chốt danh sách khách và gửi thiệp mời | 30 | 30 | 15/04/27 | 15/04/27 | 15/04/27 | 15/04/27 | 15/04/27 | 15/04/27 |  |  |
| 28 | Thuê xe hoa, xe đưa đón | 25 | 25 | 20/04/27 | 20/04/27 | 20/04/27 | 20/04/27 | 20/04/27 | 20/04/27 |  |  |
| 29 | Lên kịch bản ngày cưới: giờ đón dâu, giờ tiệc, phân… | 21 | 21 | 24/04/27 | 24/04/27 | 24/04/27 | 24/04/27 | 24/04/27 | 24/04/27 |  |  |
| 30 | Rà soát cuối: lịch trình ngày cưới, đồ cần mang, ng… | 3 | 3 | 12/05/27 | 12/05/27 | 12/05/27 | 12/05/27 | 12/05/27 | 12/05/27 |  |  |
| 31 | Cảm ơn khách, tổng kết chi phí | -7 | -7 | 22/05/27 | 22/05/27 | 22/05/27 | 22/05/27 | 22/05/27 | 22/05/27 |  |  |

Nhận xét:
- Việc xa nhất (d = 270) rơi đúng I + 1 = 16/11/26.
- Các việc có d ≤ K = 60 giữ nguyên.
- Năm việc đi gặp hoặc thử được lùi về Chủ nhật (20/12, 27/12, 03/01, 24/01, 31/01, 14/02). Việc thứ 13 bị lùi 1 ngày, từ thứ Hai 01/02 về Chủ nhật 31/01.

### Ví dụ 2. L = 21, 6 dịch vụ, Ưu tiên không gian (có gộp, có nhãn)

I = 15/11/26, W = 06/12/26, L = 21, L₁ = 20, K = 10, mức Gấp. Dịch vụ: 6, n = 30, ρ = 30 ÷ 20 = 1,50 → **gộp**. Mức chia: Ưu tiên không gian, nên thứ tự là tiệc → trang trí → hoa cưới → trang phục → trang điểm → chụp ảnh.

| STT | Việc (sau Bước 0) | d | d′ | B1: W − d | B2: W − d′ | B3: sàn I + 1 | B4: thứ tự | B5: cuối tuần | B7: hạn lưu | Gấp | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Thống nhất với hai gia đình: ngân sách, quy mô tiệc… | 270 | **20** | 11/03/26 | **16/11/26** | 16/11/26 | 16/11/26 | 16/11/26 | 16/11/26 | Gấp |  |
| 2 | Lập danh sách khách sơ bộ, chọn phong cách và màu c… | 250 | **19** | 31/03/26 | **17/11/26** | 17/11/26 | 17/11/26 | 17/11/26 | 17/11/26 | Gấp |  |
| 3 | Chọn và chốt trung tâm tiệc cưới | 180 | **17** | 09/06/26 | **19/11/26** | 19/11/26 | 19/11/26 | 19/11/26 | 19/11/26 | Gấp | 1 |
| 4 | Chọn và chốt chụp ảnh | 170 | **16** | 19/06/26 | **20/11/26** | 20/11/26 | 20/11/26 | 20/11/26 | **25/11/26** | Gấp | 6 |
| 5 | Chọn và chốt trang phục | 130 | **15** | 29/07/26 | **21/11/26** | 21/11/26 | 21/11/26 | 21/11/26 | **22/11/26** | Gấp | 4 |
| 6 | Chọn và chốt trang trí | 115 | **14** | 13/08/26 | **22/11/26** | 22/11/26 | 22/11/26 | 22/11/26 | **20/11/26** | Gấp | 2 |
| 7 | Chọn và chốt trang điểm | 95 | **13** | 02/09/26 | **23/11/26** | 23/11/26 | 23/11/26 | 23/11/26 | 23/11/26 | Gấp | 5 |
| 8 | Chọn và mua nhẫn cưới | 85 | **13** | 12/09/26 | **23/11/26** | 23/11/26 | 23/11/26 | 23/11/26 | 23/11/26 | Gấp |  |
| 9 | Thiết kế, chọn mẫu và đặt in thiệp cưới | 60 | **12** | 07/10/26 | **24/11/26** | 24/11/26 | 24/11/26 | 24/11/26 | 24/11/26 | Gấp |  |
| 10 | Chọn và chốt hoa cưới | 45 | **11** | 22/10/26 | **25/11/26** | 25/11/26 | 25/11/26 | 25/11/26 | **21/11/26** | Gấp | 3 |
| 11 | Đăng ký kết hôn | 40 | **11** | 27/10/26 | **25/11/26** | 25/11/26 | 25/11/26 | 25/11/26 | 25/11/26 | Gấp |  |
| 12 | Chốt danh sách khách và gửi thiệp mời | 30 | **11** | 06/11/26 | **25/11/26** | 25/11/26 | 25/11/26 | 25/11/26 | 25/11/26 | Gấp |  |
| 13 | Thuê xe hoa, xe đưa đón | 25 | **11** | 11/11/26 | **25/11/26** | 25/11/26 | 25/11/26 | 25/11/26 | 25/11/26 | Gấp |  |
| 14 | Lên kịch bản ngày cưới: giờ đón dâu, giờ tiệc, phân… | 21 | **10** | 15/11/26 | **26/11/26** | 26/11/26 | 26/11/26 | 26/11/26 | 26/11/26 | Gấp |  |
| 15 | Rà soát cuối: lịch trình ngày cưới, đồ cần mang, ng… | 3 | 3 | 03/12/26 | 03/12/26 | 03/12/26 | 03/12/26 | 03/12/26 | 03/12/26 |  |  |
| 16 | Cảm ơn khách, tổng kết chi phí | -7 | -7 | 13/12/26 | 13/12/26 | 13/12/26 | 13/12/26 | 13/12/26 | 13/12/26 |  |  |

Nhận xét:
- 31 việc còn 16 vì 25 việc Chọn nhà cung cấp và Mốc chốt gộp thành 6 việc "Chọn và chốt".
- Bước 7.2 giao lại sáu hạn 19, 20, 21, 22, 23 và 25/11 theo thứ tự ưu tiên: tiệc 19/11, trang trí 20/11, hoa 21/11, trang phục 22/11, trang điểm 23/11, chụp ảnh 25/11.
- Các việc có d > K đều bị nén quá 50% ở mức Gấp nên mang cờ Gấp. "Rà soát cuối" không thu gọn và là việc trước cưới muộn nhất.

### Ví dụ 3. L = 21, 2 dịch vụ: trung tâm tiệc cưới và chụp ảnh (không gộp)

I = 15/11/26, W = 06/12/26, L = 21, L₁ = 20, K = 10, mức Gấp. Dịch vụ: 2, n = 16, ρ = 16 ÷ 20 = 0,80 → không gộp. Mức chia: Cân bằng (tiệc 1, chụp ảnh 2).

| STT | Việc (sau Bước 0) | d | d′ | B1: W − d | B2: W − d′ | B3: sàn I + 1 | B4: thứ tự | B5: cuối tuần | B7: hạn lưu | Gấp | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Thống nhất với hai gia đình: ngân sách, quy mô tiệc… | 270 | **20** | 11/03/26 | **16/11/26** | 16/11/26 | 16/11/26 | 16/11/26 | 16/11/26 | Gấp |  |
| 2 | Lập danh sách khách sơ bộ, chọn phong cách và màu c… | 250 | **19** | 31/03/26 | **17/11/26** | 17/11/26 | 17/11/26 | 17/11/26 | 17/11/26 | Gấp |  |
| 3 | Lọc và hỏi giá 3–5 nhà hàng: lịch trống, giá bàn, p… | 235 | **19** | 15/04/26 | **17/11/26** | 17/11/26 | 17/11/26 | 17/11/26 | 17/11/26 | Gấp | 1 |
| 4 | Đi xem sảnh để đánh giá: sức chứa, sân khấu, bãi xe… | 205 | **18** | 15/05/26 | **18/11/26** | 18/11/26 | 18/11/26 | 18/11/26 | 18/11/26 | Gấp | 1 |
| 5 | Lọc và hỏi giá 3–5 studio chụp ảnh & quay phim: pho… | 200 | **17** | 20/05/26 | **19/11/26** | 19/11/26 | 19/11/26 | 19/11/26 | 19/11/26 | Gấp | 2 |
| 6 | Thử món theo thực đơn dự kiến, góp ý khẩu vị; xin b… | 190 | **17** | 30/05/26 | **19/11/26** | 19/11/26 | 19/11/26 | 19/11/26 | 19/11/26 | Gấp | 1 |
| 7 | Gặp tư vấn studio: xem album in thật, phim mẫu; tra… | 185 | **17** | 04/06/26 | **19/11/26** | 19/11/26 | **20/11/26** | 20/11/26 | 20/11/26 | Gấp | 2 |
| 8 | Chốt nhà hàng: so sánh, xác nhận đơn và đặt cọc | 180 | **17** | 09/06/26 | **19/11/26** | 19/11/26 | **20/11/26** | 20/11/26 | 20/11/26 | Gấp | 1 |
| 9 | Chốt chụp ảnh & quay phim: so sánh, xác nhận đơn và… | 170 | **16** | 19/06/26 | **20/11/26** | 20/11/26 | **21/11/26** | 21/11/26 | 21/11/26 | Gấp | 2 |
| 10 | Chọn và mua nhẫn cưới | 85 | **13** | 12/09/26 | **23/11/26** | 23/11/26 | 23/11/26 | 23/11/26 | 23/11/26 | Gấp |  |
| 11 | Thiết kế, chọn mẫu và đặt in thiệp cưới | 60 | **12** | 07/10/26 | **24/11/26** | 24/11/26 | 24/11/26 | 24/11/26 | 24/11/26 | Gấp |  |
| 12 | Đăng ký kết hôn | 40 | **11** | 27/10/26 | **25/11/26** | 25/11/26 | 25/11/26 | 25/11/26 | 25/11/26 | Gấp |  |
| 13 | Chốt danh sách khách và gửi thiệp mời | 30 | **11** | 06/11/26 | **25/11/26** | 25/11/26 | 25/11/26 | 25/11/26 | 25/11/26 | Gấp |  |
| 14 | Thuê xe hoa, xe đưa đón | 25 | **11** | 11/11/26 | **25/11/26** | 25/11/26 | 25/11/26 | 25/11/26 | 25/11/26 | Gấp |  |
| 15 | Lên kịch bản ngày cưới: giờ đón dâu, giờ tiệc, phân… | 21 | **10** | 15/11/26 | **26/11/26** | 26/11/26 | 26/11/26 | 26/11/26 | 26/11/26 | Gấp |  |
| 16 | Rà soát cuối: lịch trình ngày cưới, đồ cần mang, ng… | 3 | 3 | 03/12/26 | 03/12/26 | 03/12/26 | 03/12/26 | 03/12/26 | 03/12/26 |  |  |
| 17 | Cảm ơn khách, tổng kết chi phí | -7 | -7 | 13/12/26 | 13/12/26 | 13/12/26 | 13/12/26 | 13/12/26 | 13/12/26 |  |  |

Nhận xét:
- Sau Bước 2, chuỗi nhà hàng có hai việc cùng 19/11 (thử món và chốt). Bước 4 đẩy "Chốt nhà hàng" sang 20/11; chuỗi chụp ảnh cũng bị đẩy tương tự (20/11, 21/11).
- Ví dụ này không có việc nào được lùi về cuối tuần: mọi việc đi gặp hoặc thử đều bị chặn bởi ngày sàn hoặc việc liền trước, hoặc đã bị đẩy.
- Cùng L = 21 nhưng ρ = 0,80 nên không gộp: cặp đôi vẫn thấy đủ các bước chọn nhà cung cấp.

## Phụ lục A. Đối chiếu quy tắc với mã nguồn

Đường dẫn rút gọn: `BE/` = `backend/src/modules/weddings/`, `FE/` = `frontend/src/features/weddings/`.

| Quy tắc | Vị trí trong mã nguồn |
|---|---|
| Bộ 31 việc mẫu, offset, loại việc | `BE/timeline-templates.ts:40-73` |
| Hằng số 270 (`FRAME_MAX_OFFSET`) | `BE/timeline-templates.ts:38` |
| Việc không thu gọn (Rà soát cuối, Cảm ơn khách) | `BE/timeline-templates.ts:71-72` |
| Việc ưu tiên cuối tuần | `BE/timeline-templates.ts:45,47,48,53,54,60` |
| Ngày ↔ số nguyên, thứ trong tuần, round = ⌊x + 0,5⌋ | `BE/timeline-schedule.ts:12-16` |
| Phân mức theo L, chặn L ≤ 0 | `BE/timeline-schedule.ts:21-27` |
| K = min(60; max(⌊L₁/2⌋; L₁ − 20)), L₁ ≥ 270 không dồn | `BE/timeline-schedule.ts:50-53` |
| Lùi về Chủ nhật liền trước | `BE/timeline-schedule.ts:58-61` |
| Công thức d′ (Bước 2) | `BE/timeline-schedule.ts:76` |
| Lọc theo dịch vụ (trong công thức gốc) | `BE/timeline-schedule.ts:78` |
| Hạn gốc W − d, việc sau cưới W + n (Bước 1) | `BE/timeline-schedule.ts:81-87` |
| Cờ Gấp, mức thu gọn > 50% (Bước 6) | `BE/timeline-schedule.ts:88-94` |
| Việc Tự làm: ngày sàn I + 1 (Bước 3) | `BE/timeline-schedule.ts:97-108` |
| Chuỗi dịch vụ: ngày sàn, thứ tự, cuối tuần (Bước 3–5) | `BE/timeline-schedule.ts:111-138` |
| Thứ tự ưu tiên theo mức chia ngân sách | `BE/timeline-schedule.ts:161-173`, `BE/timeline-templates.ts:133-137` |
| Nhãn Ưu tiên, 0 < L ≤ 80 (Bước 7.1) | `BE/timeline-schedule.ts:178-186` |
| Gợi ý bước con lấy từ bộ mẫu | `BE/timeline-schedule.ts:192-195`, `BE/timeline-templates.ts:108-124` |
| Gộp chuỗi thành "Chọn và chốt …" | `BE/timeline-schedule.ts:202-209`, `BE/timeline-templates.ts:95-105` |
| Nhận ra dịch vụ đã gộp bằng mã | `BE/timeline-schedule.ts:215-223` |
| n, ρ, quyết định gộp (Bước 0) | `BE/timeline-schedule.ts:281-287` |
| Sắp lại hạn việc gộp theo ưu tiên (Bước 7.2) | `BE/timeline-schedule.ts:312-328` |
| Chặn W − 1, Rà soát cuối muộn nhất, bỏ qua khi W − 1 < I + 1 (Bước 7.3) | `BE/timeline-schedule.ts:330-348` |
| Cờ Gấp theo `created_date`, nhóm theo ngày | `BE/timeline-schedule.ts:359-379` |
| Thuật toán timeline chi tiết | `BE/timeline-schedule.ts:382-427` |
| Tính lại khi đổi ngày cưới, danh sách việc đã tính lại | `BE/timeline-schedule.ts:457-480` |
| Sinh dòng khung từ kết quả tính | `BE/timeline-rows.ts:80-100` |
| Nhãn Ưu tiên, việc gộp, gợi ý lúc hiển thị | `BE/timeline-rows.ts:109-125` |
| Đọc `budget_preset`, `custom_weights` | `BE/timeline-rows.ts:133-147` |
| Sinh việc chi tiết cho đơn, việc thanh toán N = E | `BE/timeline-rows.ts:179-222` |
| Tính lại việc chi tiết khi đổi E | `BE/timeline-rows.ts:240-265` |
| Đổi gói của đơn đã cọc | `BE/timeline-rows.ts:302-347` |
| Sinh khung lúc tạo đám cưới hoặc thêm dịch vụ, I = hôm nay, không sinh lại Chọn NCC của dịch vụ đã gộp | `BE/timeline-hooks.ts:26-48` |
| Đổi E của đơn → tính lại việc chi tiết | `BE/timeline-hooks.ts:61-81` |
| Đặt cọc → Mốc chốt (mã `*_BOOK`) tự xong, sinh việc chi tiết | `BE/timeline-hooks.ts:87-95` |
| Đổi ngày cưới: giữ trạng thái gộp, tính lại với I = hôm nay | `BE/timeline-hooks.ts:141-185` |
| Ghi `created_date = now()` cho việc được tính lại | `BE/timeline-hooks.ts:192-196` |
| Nhà hàng đổi ngày tiệc → đổi ngày cưới | `BE/timeline-hooks.ts:297-305` |
| D, E, I của việc chi tiết lúc đặt cọc | `BE/order-package-sync.ts:60-69` |
| Cờ Gấp lúc hiển thị (I = `created_date` của từng dòng) | `BE/timeline.service.ts:40-50,159` |
| Nhãn Ưu tiên theo hôm nay | `BE/timeline.service.ts:98,105,164` |
| Nút "Gợi ý" của việc gộp chưa chốt | `BE/timeline.service.ts:195-196` |
| Lưu đám cưới, đổi ngày cưới, sinh khung | `BE/weddings.service.ts:170-198` |
| Lời gọi lúc đặt cọc, đổi E, đồng bộ ngày tiệc | `backend/src/modules/orders/orders.service.ts:487,787,790` |
| Quá hạn, Sắp đến hạn (0–2 ngày), hiển thị Gấp và Ưu tiên | `FE/components/TimelineRow.tsx:101-103,207-208`, `FE/timelineFilter.ts:150` |
| Kiểm thử | `backend/test/timeline-schedule.test.ts`, `backend/test/timeline-frame.test.ts`, `backend/test/timeline-rows.test.ts` |

## Phụ lục B. Điểm khác giữa mã nguồn và các mô tả cũ

Tài liệu này viết theo mã nguồn. Các điểm sau khác với `docs/TIMELINE.md`, với chú thích trong mã nguồn, hoặc với đề bài giao viết tài liệu này:

1. **Cuối tuần lùi về Chủ nhật, không phải "T7/CN gần nhất".** `docs/TIMELINE.md` và chú thích ở `timeline-schedule.ts:57` ghi "T7/CN gần nhất". Mã nguồn lùi về Chủ nhật liền trước; thứ Bảy chỉ giữ được khi hạn vốn đã là thứ Bảy.
2. **Mức thu gọn của cờ Gấp tính trên hạn cuối của Bước 5**, tức (d − (W − N)) ÷ d, chứ không phải (d − d′) ÷ d như đề bài. Hai cách chỉ trùng nhau khi việc không bị kẹp, đẩy hay dời cuối tuần. Ngoài ra còn điều kiện thứ ba: N ≥ W.
3. **Cờ Gấp của việc gộp lúc hiển thị dùng thứ tự Cân bằng.** Khi tính cờ Gấp lúc hiển thị, mã nguồn chạy lại thuật toán mà không truyền mức chia ngân sách (`timeline-schedule.ts:371`). Vì vậy ở Bước 7.2, cờ Gấp được giao theo thứ tự Cân bằng, trong khi hạn đã lưu được giao theo mức chia thật. Nếu mức chia khác Cân bằng và các khe hạn có cờ Gấp khác nhau, một việc gộp có thể hiện cờ Gấp của khe khác. Trường hợp này hiếm vì khi gộp (L ≤ 31) gần như mọi việc gộp đều Gấp, nhưng đây là điểm lệch thật của mã nguồn.
4. **Nhãn Ưu tiên chỉ gắn trên việc Chọn nhà cung cấp và Mốc chốt** (kể cả việc gộp) chưa xong. Việc chi tiết của đơn không mang nhãn, dù cùng dịch vụ.
5. **Việc chi tiết không bao giờ hiện cờ Gấp.** Hàm tính việc chi tiết có đánh dấu gấp khi E − lo ≤ 0, nhưng dấu này không được lưu và không được hiển thị; cờ Gấp chỉ tính cho việc khung.
6. **Bước 7.3 chỉ được bảo đảm cho các việc của cùng một lần tính.** Khi thêm dịch vụ sau, chỉ việc mới được tính; "Rà soát cuối" đã có không được tính lại, nên có thể không còn là việc muộn nhất nếu dịch vụ mới có việc muộn hơn. Lần đổi ngày cưới kế tiếp tính lại toàn bộ và khôi phục điều kiện này.
7. **Ngày sàn ở Bước 3 trên thực tế chỉ tác động lên "Rà soát cuối" khi L ≤ 3**, vì công thức dồn lịch luôn cho d′ ≤ L₁.
8. **`docs/TIMELINE.md` còn nhiều chỗ lỗi thời so với mã nguồn:**
   - ghi bộ mẫu có 62 việc với các mốc W/E/D/S (mã nguồn có 31 việc, mọi việc neo theo W);
   - có mốc W + 30 không thu gọn (không còn);
   - việc chi tiết dùng D + k với k = 2 hoặc 3, có ngày chụp album S và W − 7 (mã nguồn dùng lo = D + 2 cố định, việc chi tiết lấy từ gói của nhà cung cấp, không có S);
   - mục Vòng đời ghi "không bao giờ dời việc đã sinh", trong khi đổi ngày cưới có tính lại việc khung chưa xong.
9. **Chú thích lỗi thời trong mã nguồn.** Chú thích của `planFrame` (`timeline-schedule.ts:65`) ghi "Khung không bao giờ bị dời sau khi đã sinh", không đúng với việc tính lại khi đổi ngày cưới. Trường `priority` của kết quả `planTimeline` là nhãn theo L lúc tính; giao diện dùng nhãn tính theo hôm nay (`priorityLabels`).
10. **Chữ `n` trong mã nguồn mang hai nghĩa:** hạn dạng ngày trong `planFrame`, và số việc trước cưới trong `planTimeline`. Tài liệu này dùng N cho hạn và n cho số việc.
11. **"Thêm dịch vụ sau" xét mật độ trên toàn bộ dịch vụ đang chọn**, không chỉ dịch vụ mới; n gồm cả việc chung và việc của các dịch vụ cũ.
12. **Đổi ngày cưới tính lại theo các dịch vụ có việc trong timeline**, kể cả dịch vụ cặp đôi đã bỏ chọn (việc của dịch vụ đó bị ẩn nhưng vẫn còn trong cơ sở dữ liệu).

## Phụ lục C. Đề xuất ký hiệu tránh trùng với chương ngân sách

Chương ngân sách đang dùng **L** cho "tổng tỷ lệ các hạng mục đã khoá" (đơn vị phần vạn, trong thuật toán tự cân bằng: hạng mục mở khoá bị kẹp về [0; 10000 − L]). Ở chương timeline, L là thời gian chuẩn bị và trùng với tên biến trong mã nguồn (`L`, `L1`).

Đề xuất:
- **Giữ L, L₁ cho timeline**, vì khớp tên biến trong mã nguồn và các bảng kiểm thử.
- **Đổi ký hiệu bên ngân sách thành P_k** (tổng tỷ lệ khoá; hoặc Σ_khoá), ví dụ kẹp về [0; 10000 − P_k].
- Nếu nhóm muốn giữ L bên ngân sách thì timeline đổi sang **T** (thời gian chuẩn bị) và **T₁ = T − 1**. Khi đó cần ghi chú trong báo cáo rằng T tương ứng với biến `L` trong mã nguồn.
