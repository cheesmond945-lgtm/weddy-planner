-- Bỏ " (bàn 10 người)" / " (mâm 10 người)" (cả ngoặc) khỏi tên việc đã sinh: dễ gây hiểu lầm (khách có thể đặt bàn 8 người).
-- Mẫu mới (timeline-templates.ts, package_tasks_seed.json) đã bỏ cụm này; file này sửa các dòng đã có trong CSDL.
-- Đã chạy trên CSDL dùng chung ngày 04/11/2026. Chạy lại không sao (không còn dòng nào khớp).
-- Dòng cuối dọn " ()" còn sót từ lần chạy đầu (khi đó chỉ xóa chữ trong ngoặc).

BEGIN;

UPDATE timeline_tasks SET title = replace(replace(title, ' (bàn 10 người)', ''), ' (mâm 10 người)', '')
WHERE strpos(title, ' (bàn 10 người)') > 0 OR strpos(title, ' (mâm 10 người)') > 0;

UPDATE package_tasks SET title = replace(replace(title, ' (bàn 10 người)', ''), ' (mâm 10 người)', '')
WHERE strpos(title, ' (bàn 10 người)') > 0 OR strpos(title, ' (mâm 10 người)') > 0;

UPDATE timeline_tasks SET title = replace(title, ' ()', '') WHERE strpos(title, ' ()') > 0;
UPDATE package_tasks SET title = replace(title, ' ()', '') WHERE strpos(title, ' ()') > 0;

COMMIT;
