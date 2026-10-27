import { ApiError } from '@/api/client'
import type { GoogleRating, GoogleRatingMode, GoogleReview } from '@/types/googleRating'

/*
 * TẠM: điểm và đánh giá Google Maps giả, theo id nhà cung cấp (ở FE đang gọi là service id).
 * Chỉ nằm trong mã nguồn, không ghi vào bộ nhớ trình duyệt (đúng quy định của Google).
 *
 * Tình huống để thử:
 * - sv-1, sv-5, sv-8: đủ 5 đánh giá (sv-1 và sv-8 có đánh giá rất dài; tên tác giả tiếng Việt có dấu)
 * - sv-2: chỉ 2 đánh giá
 * - sv-3: có điểm nhưng 0 đánh giá có nội dung
 * - sv-19: địa điểm chưa có điểm (rating null)
 * - sv-7: nhà cung cấp chưa có PlaceId -> 404
 * - mọi lần gọi: trễ 300–800ms, khoảng 8% lỗi 502 (React Query thử lại 1 lần)
 * - ép lỗi 502 để thử nút "Thử lại": chạy localStorage.setItem('weddy.mock.googleError', '1') trong Console
 *   (cờ gỡ lỗi, không phải dữ liệu Google); '0' = không bao giờ lỗi; xóa cờ = lỗi ngẫu nhiên như trên
 */

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

const LONG_TEXT =
  'Tụi mình tổ chức tiệc 450 khách ở đây vào cuối tháng 12. Từ lúc khảo sát đến ngày cưới, bạn quản lý sảnh luôn trả lời tin nhắn rất nhanh, gửi sơ đồ bàn và thực đơn thử trước hai tuần. ' +
  'Món ăn được khách khen nhiều nhất là gà hấp lá chanh và lẩu hải sản, lên món đúng giờ, nóng. Nhân viên phục vụ đông, đồng phục gọn gàng. Âm thanh ánh sáng ổn, MC của nhà hàng dẫn duyên. ' +
  'Điểm trừ nhỏ là bãi giữ xe máy hơi chật vào giờ cao điểm và thang máy lên sảnh phải chờ lâu. Nhìn chung rất đáng tiền, gia đình hai bên đều hài lòng, sẽ giới thiệu cho bạn bè.'

const review = (authorName: string, rating: number, text: string, days: number, extra: Partial<GoogleReview> = {}): GoogleReview => ({
  authorName,
  rating,
  text,
  publishTime: ago(days),
  languageCode: 'vi',
  ...extra,
})

const contrib = (n: number) => `https://www.google.com/maps/contrib/1${String(n).padStart(20, '0')}`

interface Seed {
  name: string
  placeId: string | null
  rating: number | null
  userRatingCount: number
  reviews: GoogleReview[]
}

/** Đánh giá chung cho các NCC không có kịch bản riêng */
const generic = (name: string): GoogleReview[] => [
  review('Phạm Thu Hà', 5, `Dịch vụ của ${name} rất chuyên nghiệp, đúng hẹn và tư vấn nhiệt tình.`, 9, { authorUri: contrib(31) }),
  review('Lê Quang Huy', 4, 'Chất lượng tốt so với giá, chỉ cần báo lịch sớm vì mùa cưới rất đông khách.', 40),
  review('Đỗ Mai Anh', 5, 'Gia đình mình hài lòng, sẽ giới thiệu cho bạn bè.', 75, { authorUri: contrib(33) }),
]

const SEEDS: Record<string, Seed> = {
  'sv-1': {
    name: 'Grand Lotus Palace', placeId: 'ChIJmock-grand-lotus', rating: 4.7, userRatingCount: 1824,
    reviews: [
      review('Nguyễn Thị Hồng Nhung', 5, LONG_TEXT, 6, { authorUri: contrib(1), authorPhotoUri: 'https://images.unsplash.com/photo-1585241920473-b472eb9ffbae?auto=format&w=96&h=96&fit=crop&crop=focalpoint&fp-y=0.2&fp-z=2' }),
      review('Trần Minh Đức', 5, 'Sảnh rộng, trần cao, đèn chùm đẹp. Thực đơn đa dạng, nhân viên lịch sự.', 18, { authorUri: contrib(2) }),
      review('Hoàng Bảo Ngọc', 4, 'Không gian sang, món ngon. Giá hơi cao so với mặt bằng chung nhưng xứng đáng.', 33),
      review('Vũ Đình Khôi', 5, 'Đặt tiệc cho em gái, mọi thứ chu đáo từ đón khách tới tiễn khách.', 61, { authorUri: contrib(4) }),
      review('Bùi Thị Thanh Xuân', 4, 'Bãi xe rộng, thuận tiện cho khách ở xa. Phục vụ hơi chậm lúc đông.', 120),
    ],
  },
  'sv-2': {
    name: 'Sen Vàng Convention', placeId: 'ChIJmock-sen-vang', rating: 4.5, userRatingCount: 932,
    reviews: [
      review('Ngô Thùy Dương', 5, 'Gần trung tâm, dễ tìm. Thực đơn 10 món vừa miệng, khách lớn tuổi khen nhiều.', 12, { authorUri: contrib(11) }),
      review('Đặng Văn Toàn', 4, 'Sảnh 400 khách vừa đủ, âm thanh tốt.', 47),
    ],
  },
  'sv-3': { name: 'Hoàng Gia Garden', placeId: 'ChIJmock-hoang-gia', rating: 4.8, userRatingCount: 2410, reviews: [] },
  'sv-4': { name: 'Sông Hồng Ballroom', placeId: 'ChIJmock-song-hong', rating: 4.6, userRatingCount: 1120, reviews: generic('Sông Hồng Ballroom') },
  'sv-5': {
    name: 'Mộc Decor', placeId: 'ChIJmock-moc-decor', rating: 4.8, userRatingCount: 214,
    reviews: [
      review('Trịnh Khánh Linh', 5, 'Concept tối giản đúng ý, hoa tươi, dựng sảnh nhanh gọn trong buổi sáng.', 4, { authorUri: contrib(21) }),
      review('Lưu Hữu Phước', 5, 'Bảng màu be và xanh lá rất tinh tế, ảnh lên đẹp.', 15),
      review('Quách Thị Yến Nhi', 4, 'Đẹp, nhưng nên chốt mẫu sớm vì cuối tuần họ kín lịch.', 29, { authorUri: contrib(23) }),
      review('Châu Ngọc Ánh', 5, 'Đội thi công cẩn thận, dọn dẹp sạch sẽ sau tiệc.', 52),
      review('Mạc Đăng Khoa', 5, 'Giá hợp lý cho chất lượng.', 90, { authorUri: contrib(25) }),
    ],
  },
  'sv-6': { name: 'Luna Wedding Decor', placeId: 'ChIJmock-luna', rating: 4.7, userRatingCount: 186, reviews: generic('Luna Wedding Decor') },
  'sv-7': { name: 'Nắng Studio Decor', placeId: null, rating: null, userRatingCount: 0, reviews: [] },
  'sv-8': {
    name: 'An Nhiên Makeup', placeId: 'ChIJmock-an-nhien', rating: 4.9, userRatingCount: 342,
    reviews: [
      review('Đoàn Phương Thảo', 5, LONG_TEXT.replace('tiệc 450 khách ở đây', 'makeup cô dâu ở đây'), 3, { authorUri: contrib(41) }),
      review('Nguyễn Ngọc Diệp', 5, 'Makeup tự nhiên, bền màu cả ngày, chị thợ chính dễ thương.', 21),
      review('Phan Thị Mỹ Duyên', 5, 'Có buổi thử trước nên rất yên tâm.', 37, { authorUri: contrib(43) }),
      review('Tô Hoài Nam', 4, 'Đến tận nhà trang điểm cho cả mẹ cô dâu, đúng giờ.', 66),
      review('Kiều Oanh', 5, 'Sẽ quay lại khi em gái cưới.', 140),
    ],
  },
  'sv-9': { name: 'Mi Bridal Makeup', placeId: 'ChIJmock-mi-bridal', rating: 4.8, userRatingCount: 276, reviews: generic('Mi Bridal Makeup') },
  'sv-10': { name: 'Hạ Makeup Artist', placeId: 'ChIJmock-ha-makeup', rating: 4.7, userRatingCount: 121, reviews: generic('Hạ Makeup Artist') },
  'sv-11': { name: 'Lumi Wedding Studio', placeId: 'ChIJmock-lumi', rating: 4.9, userRatingCount: 528, reviews: generic('Lumi Wedding Studio') },
  'sv-12': { name: 'Mây Studio', placeId: 'ChIJmock-may', rating: 4.8, userRatingCount: 391, reviews: generic('Mây Studio') },
  'sv-13': { name: 'Biển Xanh Photography', placeId: 'ChIJmock-bien-xanh', rating: 4.7, userRatingCount: 203, reviews: generic('Biển Xanh Photography') },
  'sv-17': { name: 'Maison Bridal', placeId: 'ChIJmock-maison', rating: 4.9, userRatingCount: 305, reviews: generic('Maison Bridal') },
  'sv-18': { name: 'Sweetie Bridal', placeId: 'ChIJmock-sweetie', rating: 4.7, userRatingCount: 251, reviews: generic('Sweetie Bridal') },
  'sv-19': { name: 'Hoa Hồng Bridal', placeId: 'ChIJmock-hoa-hong', rating: null, userRatingCount: 0, reviews: [] },
  'sv-20': { name: 'Riverside Palace', placeId: 'ChIJmock-riverside', rating: 4.5, userRatingCount: 950, reviews: generic('Riverside Palace') },
}

const mapsUri = (s: Seed) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} Hà Nội`)}&query_place_id=${s.placeId}`

/** Trả dữ liệu như BE (không trễ, không lỗi ngẫu nhiên). Mock khác (gợi ý AI) dùng hàm này như BE gọi Google. */
export function readMockGoogleRating(vendorId: string, mode: GoogleRatingMode): GoogleRating {
  const s = SEEDS[vendorId]
  if (!s || !s.placeId) throw new ApiError(404, 'VENDOR_PLACE_NOT_FOUND', 'Nhà cung cấp chưa liên kết địa điểm Google Maps.')
  const base: GoogleRating = { placeId: s.placeId, rating: s.rating, userRatingCount: s.userRatingCount, googleMapsUri: mapsUri(s) }
  return mode === 'reviews' ? { ...base, reviews: s.reviews.slice(0, 5), reviewsSortedBy: 'relevance' } : base
}

/** Cờ gỡ lỗi: '1' luôn lỗi 502, '0' không bao giờ lỗi, không đặt thì lỗi ngẫu nhiên ~8%. */
function errorMode(): 'always' | 'never' | 'random' {
  try {
    const v = localStorage.getItem('weddy.mock.googleError')
    return v === '1' ? 'always' : v === '0' ? 'never' : 'random'
  } catch {
    return 'random'
  }
}

export const mockGoogleRating = {
  /** GET /vendors/{vendorId}/google-rating giả: trễ 300–800ms, thỉnh thoảng 502. */
  get(vendorId: string, mode: GoogleRatingMode): Promise<GoogleRating> {
    // Ghi log để kiểm tra trong Console (chế độ mock không có request mạng thật)
    console.info(`[mock] GET /vendors/${vendorId}/google-rating?fields=${mode}`)
    const delay = 300 + Math.random() * 500
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          const mode2 = errorMode()
          if (mode2 === 'always' || (mode2 === 'random' && Math.random() < 0.08)) throw new ApiError(502, 'GOOGLE_UPSTREAM_ERROR', 'Không lấy được dữ liệu từ Google Maps, vui lòng thử lại.')
          resolve(readMockGoogleRating(vendorId, mode))
        } catch (e) {
          reject(e)
        }
      }, delay),
    )
  },
}
