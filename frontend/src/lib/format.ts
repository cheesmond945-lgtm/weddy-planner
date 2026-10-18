/** 128000000 -> "128.000.000đ" (như fm trong prototype). */
export function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`
}

/** 185500000 -> "185,5 triệu" (như tr trong prototype). */
export function formatMillions(amount: number) {
  return `${(amount / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`
}

/** 1824 -> "1.824" */
export function formatNumber(n: number) {
  return n.toLocaleString('vi-VN')
}
