// Danh sách từ cấm cho nội dung đánh giá. Thêm/bớt từ ở đây rồi deploy lại.
// Cố ý bỏ các từ không dấu trùng chữ thường: deo (đeo), lon (lớn), du (du lịch), cac (các), cc.
export const BANNED_WORDS: readonly string[] = [
  'địt', 'dit', 'địt mẹ', 'dit me', 'đụ mẹ', 'du me', 'đụ má',
  'đm', 'dm', 'đmm', 'dmm', 'đcm', 'dcm', 'đkm', 'dkm', 'đcmm', 'dcmm',
  'vcl', 'vkl', 'vl', 'vãi lồn', 'vai lon', 'cmm', 'clm', 'clgt',
  'lồn', 'cặc', 'buồi', 'đéo', 'đĩ', 'con đĩ',
  'thằng chó', 'con chó', 'đồ chó', 'chó đẻ', 'cho de',
  'súc vật', 'suc vat', 'khốn nạn', 'khon nan', 'mất dạy', 'mat day',
  'óc chó', 'oc cho', 'đồ ngu', 'do ngu', 'thằng ngu', 'ngu ngốc', 'ngu si',
  'đần độn', 'dan don', 'thằng điên', 'con điên',
];

const normalize = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Khớp theo ranh giới từ (chữ/số Unicode) để không chặn nhầm từ chứa chuỗi con.
const BANNED_REGEX = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${BANNED_WORDS.map((w) => escapeRegex(normalize(w))).join('|')})(?![\\p{L}\\p{N}])`,
  'u',
);

export function containsBannedWord(text: string): boolean {
  return BANNED_REGEX.test(normalize(text));
}
