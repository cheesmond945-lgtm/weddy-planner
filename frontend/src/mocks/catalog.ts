import { ApiError } from '@/api/client'
import type { Paginated } from '@/types/api'
import type { Category, ServiceDetail, ServiceListQuery, ServiceSummary } from '@/types/catalog'

/*
 * Dữ liệu giả chép từ docs/prototype/prototype.html (CATS, SV, STYLES, ADDR, PK, INTRO).
 * Điểm Google Maps không nằm ở đây: xem mocks/googleRating.ts (cột điểm/số đánh giá trong seed chỉ để tham khảo).
 */

const IMG = {
  restaurant: 'photo-1519167758481-83f550bb49b3',
  decor: 'photo-1519225421980-715cb0215aed',
  makeup: 'photo-1522335789203-aabd1fc54bc9',
  photo: 'photo-1537633552985-df8429e8048b',
  dress: 'photo-1585241920473-b472eb9ffbae', // ảnh trong prototype (photo-1594552072238…) đã bị Unsplash gỡ
  feast: 'photo-1414235077428-338989a2e8c0',
  flower: 'photo-1494438639946-1ebd1d20bf85',
}

/** Ảnh Unsplash; truyền điểm cắt để tạo ra nhiều ảnh khác nhau từ một ảnh gốc (thay cho CROPS trong prototype). */
function unsplash(id: string, w = 900, crop?: [number, number, number]) {
  const base = `https://images.unsplash.com/${id}?auto=format&q=80&w=${w}`
  if (!crop) return `${base}&fit=crop`
  const [x, y, z] = crop
  return `${base}&h=${Math.round(w * 0.66)}&fit=crop&crop=focalpoint&fp-x=${x}&fp-y=${y}&fp-z=${z}`
}

const CROPS: [number, number, number][] = [
  [0.5, 0.5, 1],
  [0.15, 0.25, 1.7],
  [0.85, 0.3, 1.7],
  [0.25, 0.85, 1.8],
  [0.8, 0.8, 1.9],
  [0.5, 0.15, 1.5],
  [0.1, 0.6, 1.8],
  [0.9, 0.55, 1.7],
]

interface CategorySeed {
  slug: string
  name: string
  hero: string
  /** Ảnh dùng cho thẻ và album dịch vụ thuộc danh mục */
  serviceImage: string
  intro: string
  packages: [string, string][]
}

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    slug: 'nha-hang', name: 'Nhà hàng', hero: IMG.restaurant, serviceImage: IMG.restaurant,
    intro: 'là không gian tiệc được thiết kế cho những buổi đoàn tụ đông đủ, từ đón khách, lên món đến phục vụ đều có đội ngũ riêng theo sát.',
    packages: [['Gói tiêu chuẩn', 'Khoảng 25 bàn, thực đơn 10 món'], ['Gói cao cấp', 'Khoảng 35 bàn, thực đơn 12 món, trang trí sảnh']],
  },
  {
    slug: 'decor', name: 'Decor', hero: IMG.decor, serviceImage: IMG.decor,
    intro: 'không chỉ là trang trí cưới mà là một không gian được dựng lên để tôn vinh khoảnh khắc của cặp đôi, từ cổng hoa đến sân khấu.',
    packages: [['Gói cổng hoa và bàn gallery', 'Cổng hoa, bàn gallery, bàn ký tên'], ['Gói trọn sảnh tiệc', 'Toàn bộ sảnh, sân khấu, lối đi hoa']],
  },
  {
    slug: 'trang-phuc', name: 'Trang phục', hero: IMG.dress, serviceImage: IMG.dress,
    intro: 'cho thuê và may đo trang phục cưới, có thử đồ và chỉnh sửa để vừa vặn trước ngày cưới.',
    packages: [['Gói thuê 2 bộ', '2 bộ trang phục cô dâu, 1 bộ vest chú rể'], ['Gói thuê 4 bộ', '4 bộ trang phục cô dâu, 2 bộ vest, phụ kiện']],
  },
  {
    slug: 'makeup', name: 'Makeup', hero: IMG.makeup, serviceImage: IMG.makeup,
    intro: 'trang điểm theo đúng gương mặt và trang phục của cô dâu, có buổi thử trước để chốt phong cách.',
    packages: [['Gói cô dâu', 'Makeup và làm tóc cô dâu'], ['Gói cô dâu và người thân', 'Cô dâu và 2 người thân, kèm trang điểm lại giữa tiệc']],
  },
  {
    slug: 'chup-anh', name: 'Chụp ảnh', hero: IMG.photo, serviceImage: IMG.photo,
    intro: 'ghi lại ngày cưới bằng ngôn ngữ ảnh tự nhiên, có nhiếp ảnh gia phụ trách trực tiếp từ ngoại cảnh đến ngày cưới.',
    packages: [['Gói ngoại cảnh 1 ngày', '1 địa điểm, 1 nhiếp ảnh gia, 40 ảnh chỉnh sửa'], ['Gói ngoại cảnh và phóng sự', 'Ngoại cảnh, phóng sự trong ngày cưới, album 30x30']],
  },
  {
    slug: 'co-cuoi', name: 'Cỗ cưới', hero: IMG.feast, serviceImage: IMG.restaurant,
    intro: 'chuyên thực đơn tiệc cưới theo số lượng khách, chế biến và phục vụ tại chỗ đúng giờ, đúng khẩu phần đã chốt.',
    packages: [['Gói cỗ cưới tiêu chuẩn', 'Thực đơn tiệc cưới theo số lượng khách'], ['Gói cỗ cưới cao cấp', 'Thực đơn nâng cao và phục vụ tại tiệc']],
  },
  {
    slug: 'hoa-cuoi', name: 'Hoa cưới', hero: IMG.flower, serviceImage: IMG.decor,
    intro: 'thiết kế hoa cưới theo bảng màu và phong cách của cặp đôi, từ hoa cầm tay đến hoa bàn tiệc.',
    packages: [['Gói hoa cưới cơ bản', 'Hoa cầm tay cô dâu và hoa cài áo'], ['Gói hoa cưới trọn bộ', 'Hoa cầm tay, hoa bàn tiệc và hoa trang trí']],
  },
]

const LOCATIONS = ['Hà Nội', 'Hải Phòng', 'Thái Bình', 'Hưng Yên', 'Hà Nam']

// [id, tên, slug danh mục, giá từ, điểm, số đánh giá, sức chứa, điểm nổi bật, phong cách, địa chỉ]
type ServiceSeed = [number, string, string, number, number, number, number | null, string[], string[], string]

const SERVICE_SEEDS: ServiceSeed[] = [
  [1, 'Grand Lotus Palace', 'nha-hang', 128000000, 4.7, 1824, 600, ['Sảnh chính 600 khách', 'Có sảnh ngoài trời', 'Bãi đỗ xe 120 chỗ'], ['Sang trọng', 'Truyền thống'], 'Số 18 Đại lộ Thăng Long, P. Mễ Trì, Q. Nam Từ Liêm'],
  [2, 'Sen Vàng Convention', 'nha-hang', 96000000, 4.5, 932, 400, ['Sảnh 400 khách', 'Thực đơn 10 món', 'Gần trung tâm'], ['Truyền thống', 'Cổ điển'], 'Số 62 Phố Trần Duy Hưng, P. Trung Hòa, Q. Cầu Giấy'],
  [3, 'Hoàng Gia Garden', 'nha-hang', 142000000, 4.8, 2410, 700, ['Sân vườn rộng', 'Sảnh 700 khách', 'Có phòng thay đồ riêng'], ['Sân vườn', 'Sang trọng'], 'Số 120 Đường Âu Cơ, P. Nhật Tân, Q. Tây Hồ'],
  [4, 'Sông Hồng Ballroom', 'co-cuoi', 88000000, 4.6, 1120, 450, ['View sông Hồng', 'Sảnh 450 khách', 'Thực đơn hải sản'], ['Hiện đại', 'Sang trọng'], 'Số 5 Phố Vĩnh Tuy, P. Vĩnh Tuy, Q. Hai Bà Trưng'],
  [5, 'Mộc Decor', 'decor', 22000000, 4.8, 214, null, ['Phong cách tối giản', 'Hoa tươi nhập theo mùa', 'Dựng sảnh trong 4 giờ'], ['Tối giản', 'Sân vườn'], 'Số 27 Phố Tây Sơn, P. Quang Trung, Q. Đống Đa'],
  [6, 'Luna Wedding Decor', 'decor', 34000000, 4.7, 186, null, ['Cổng hoa lớn', 'Bảng gallery ảnh cưới', 'Tùy chỉnh bảng màu'], ['Sang trọng', 'Hiện đại'], 'Số 41 Phố Nguyễn Chí Thanh, P. Láng Hạ, Q. Đống Đa'],
  [7, 'Nắng Studio Decor', 'hoa-cuoi', 18000000, 4.6, 97, null, ['Concept biển', 'Giá gọn cho tiệc nhỏ', 'Nhận dựng ngoài trời'], ['Tối giản', 'Sân vườn'], 'Số 15 Phố Hoàng Quốc Việt, P. Nghĩa Đô, Q. Cầu Giấy'],
  [8, 'An Nhiên Makeup', 'makeup', 7000000, 4.9, 342, null, ['Makeup thử miễn phí', 'Phong cách tự nhiên', 'Nhận trang điểm tại nhà'], ['Tối giản', 'Hiện đại'], 'Số 33 Phố Hàng Bài, P. Hàng Bài, Q. Hoàn Kiếm'],
  [9, 'Mi Bridal Makeup', 'makeup', 9500000, 4.8, 276, null, ['Chuyên viên chính trực tiếp làm', 'Bền màu 12 giờ', 'Kèm làm tóc'], ['Sang trọng', 'Cổ điển'], 'Số 76 Phố Chùa Bộc, P. Trung Liệt, Q. Đống Đa'],
  [10, 'Hạ Makeup Artist', 'makeup', 6000000, 4.7, 121, null, ['Phong cách Hàn Quốc', 'Có gói cho người thân', 'Nhận lịch sáng sớm'], ['Hiện đại', 'Tối giản'], 'Số 12 Phố Kim Mã, P. Kim Mã, Q. Ba Đình'],
  [11, 'Lumi Wedding Studio', 'chup-anh', 14000000, 4.9, 528, null, ['Album 30x30', 'Chỉnh sửa 40 ảnh', 'Studio có 6 phim trường'], ['Tối giản', 'Hiện đại'], 'Số 88 Phố Láng Hạ, P. Thành Công, Q. Ba Đình'],
  [12, 'Mây Studio', 'chup-anh', 11500000, 4.8, 391, null, ['Chụp ngoại cảnh 1 ngày', 'Nhận ảnh trong 21 ngày', 'Có hỗ trợ trang phục'], ['Hiện đại', 'Sân vườn'], 'Số 24 Phố Lê Văn Lương, P. Nhân Chính, Q. Thanh Xuân'],
  [13, 'Biển Xanh Photography', 'chup-anh', 10000000, 4.7, 203, null, ['Chụp ngoại cảnh biển', 'Nhiếp ảnh gia 8 năm kinh nghiệm', 'Tặng ảnh phóng lớn'], ['Sân vườn', 'Tối giản'], 'Số 51 Phố Nguyễn Trãi, P. Thượng Đình, Q. Thanh Xuân'],
  [17, 'Maison Bridal', 'trang-phuc', 12000000, 4.9, 305, null, ['Váy thiết kế riêng', 'Chỉnh sửa miễn phí', 'Vest cho chú rể'], ['Sang trọng', 'Cổ điển'], 'Số 29 Phố Hàng Gai, P. Hàng Gai, Q. Hoàn Kiếm'],
  [18, 'Sweetie Bridal', 'trang-phuc', 9000000, 4.7, 251, null, ['Hơn 300 mẫu váy', 'Thử đồ không giới hạn', 'Kèm phụ kiện'], ['Hiện đại', 'Tối giản'], 'Số 103 Phố Thái Hà, P. Trung Liệt, Q. Đống Đa'],
  [19, 'Hoa Hồng Bridal', 'trang-phuc', 8000000, 4.6, 132, null, ['Váy cưới và áo dài', 'Giao đồ tận nơi', 'Thuê theo ngày'], ['Truyền thống', 'Cổ điển'], 'Số 8 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng'],
  // Thêm (không có trong prototype): nhà hàng thứ 4 để thử khóa khi đã chọn đủ 3, giá/điểm gần Sen Vàng để thử trường hợp ngang nhau
  [20, 'Riverside Palace', 'nha-hang', 97000000, 4.5, 950, 450, ['Sảnh 450 khách', 'Sân khấu LED', 'Gần cầu Long Biên'], ['Hiện đại', 'Truyền thống'], 'Số 2 Phố Nguyễn Văn Cừ, P. Ngọc Lâm, Q. Long Biên'],
]

/** Giá gói thứ hai như pkgPrice trong prototype. */
const premiumPrice = (p: number) => Math.round((p * 1.45) / 500000) * 500000

const categories = CATEGORY_SEEDS.map((c, i) => ({ ...c, id: `cat-${i + 1}` }))
const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug)!

const services: ServiceDetail[] = SERVICE_SEEDS.map(([n, name, slug, price, _rating, _reviewCount, capacity, highlights, styles, address]) => {
  const cat = categoryBySlug(slug)
  const id = `sv-${n}`
  const images = CROPS.map((crop, i) => unsplash(cat.serviceImage, i === 0 ? 1400 : 900, crop))
  const prices = [price, premiumPrice(price)]
  return {
    id,
    name,
    category: { id: cat.id, slug: cat.slug, name: cat.name },
    location: 'Hà Nội',
    priceFrom: prices[0],
    priceTo: prices[1],
    coverImageUrl: unsplash(cat.serviceImage),
    address: `${address}, Hà Nội`,
    description: `${name} ${cat.intro}`,
    highlights,
    capacity,
    styles,
    workingHours: ['nha-hang', 'co-cuoi'].includes(slug) ? '08:00 - 22:00 (Hàng ngày)' : '09:00 - 21:00 (Hàng ngày)',
    isVerified: true,
    isGuaranteed: true,
    images,
    packages: cat.packages.map(([pName, pDesc], i) => ({ id: `${id}-pkg-${i + 1}`, name: pName, description: pDesc, price: prices[i] })),
    albums: [0, 1].map((a) => ({
      id: `${id}-album-${a + 1}`,
      title: `${name}, bộ ảnh ${String(a + 1).padStart(2, '0')}`,
      imageCount: a ? 13 : 14,
      previewImageUrls: [0, 1, 2].map((j) => unsplash(cat.serviceImage, 600, CROPS[(a * 3 + j + 1) % CROPS.length])),
    })),
  }
})

const toSummary = ({ id, name, category, location, priceFrom, coverImageUrl }: ServiceDetail): ServiceSummary => ({
  id, name, category, location, priceFrom, coverImageUrl,
})

export const mockCatalog = {
  listCategories(): Category[] {
    return categories.map(({ id, slug, name, hero }) => ({
      id, slug, name,
      imageUrl: unsplash(hero),
      serviceCount: services.filter((s) => s.category.slug === slug).length,
    }))
  },

  listLocations(): string[] {
    return LOCATIONS
  },

  listServices({ q, category, location, priceMin, priceMax, page = 1, pageSize = 24 }: ServiceListQuery): Paginated<ServiceSummary> {
    // Như BE: khớp tên, danh mục, địa chỉ; không phân biệt dấu và hoa thường ("cau giay" khớp "Cầu Giấy")
    const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    const keyword = q?.trim() ? fold(q.trim()) : ''
    const matched = services.filter(
      (s) =>
        (!keyword || fold(`${s.name} ${s.category.name} ${s.address ?? ''} ${s.location}`).includes(keyword)) &&
        (!category || s.category.slug === category) &&
        (!location || s.location === location) &&
        (priceMin === undefined || s.priceFrom >= priceMin) &&
        (priceMax === undefined || s.priceFrom < priceMax),
    )
    const start = (page - 1) * pageSize
    return {
      data: matched.slice(start, start + pageSize).map(toSummary),
      meta: { page, pageSize, total: matched.length, totalPages: Math.ceil(matched.length / pageSize) },
    }
  },

  getSummary(id: string): ServiceSummary {
    return toSummary(mockCatalog.getService(id))
  },

  getService(id: string): ServiceDetail {
    const s = services.find((x) => x.id === id)
    if (!s) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.')
    return s
  },
}
