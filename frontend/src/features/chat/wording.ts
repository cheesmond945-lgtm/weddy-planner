/**
 * Tin hệ thống lưu MỘT bản dùng chung cho hai phía (docs/CHOT_NGHIEP_VU_NCC.md mục 5); phía khách đổi chữ khi hiển thị:
 * "Khách yêu cầu chỉnh sửa đơn X: …" thành "Bạn đã yêu cầu chỉnh sửa đơn X: …", "NCC đã hủy đơn X · …" thành "{tên NCC} đã hủy đơn X · …".
 */
export function coupleWording(content: string, vendorName: string) {
  return content.replace(/^Khách yêu cầu chỉnh sửa đơn/, 'Bạn đã yêu cầu chỉnh sửa đơn').replace(/^NCC đã hủy đơn/, `${vendorName} đã hủy đơn`)
}
