/*
 * Các giọng văn NCC chọn trong hộp thoại "Tạo với AI". Hồ sơ (NCC tự giới thiệu) và gói dịch vụ (mô tả hàng bán) có bộ giọng riêng,
 * nhưng cùng một nguyên tắc: chỉ dùng thông tin được cung cấp, không bịa số liệu, ưu đãi hay cam kết.
 */
export interface WritingStyle {
  /** Mô tả giọng văn đưa vào lời dặn cho AI */
  instruction: string;
}

export const PROFILE_STYLES = {
  professional: { instruction: 'Giọng chuyên nghiệp, lịch sự, đáng tin cậy; câu văn gọn, rõ ý, xưng "chúng tôi".' },
  warm: { instruction: 'Giọng ấm áp, thân thiện, gần gũi như đang trò chuyện với cặp đôi; xưng "chúng tôi", có thể xưng hô "bạn" với khách.' },
  elegant: { instruction: 'Giọng tinh tế, thanh lịch, giàu hình ảnh nhưng không sáo rỗng, tạo cảm giác cao cấp; xưng "chúng tôi".' },
} satisfies Record<string, WritingStyle>;

export const PACKAGE_STYLES = {
  clear: { instruction: 'Giọng rõ ràng, thực tế: nêu gọn gàng điều quan trọng cặp đôi cần biết, ít tính từ, dễ so sánh với các gói khác.' },
  romantic: { instruction: 'Giọng lãng mạn, giàu cảm xúc, nhắc tới ngày trọng đại và khoảnh khắc của cặp đôi, nhưng vẫn bám sát dữ liệu.' },
  youthful: { instruction: 'Giọng trẻ trung, năng động, thoải mái, câu ngắn, gần gũi với các cặp đôi trẻ; không dùng tiếng lóng quá đà.' },
} satisfies Record<string, WritingStyle>;

export type ProfileStyleId = keyof typeof PROFILE_STYLES;
export type PackageStyleId = keyof typeof PACKAGE_STYLES;

/** Giọng không hợp lệ thì dùng giọng đầu tiên của bộ. */
export function pickStyle<T extends Record<string, WritingStyle>>(styles: T, id: unknown): WritingStyle {
  return typeof id === 'string' && id in styles ? styles[id as keyof T] : Object.values(styles)[0];
}
