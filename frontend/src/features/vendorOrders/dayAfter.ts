/** Ngày liền sau một ngày "YYYY-MM-DD": ngày đầu tiên được Hoàn tất đơn (sau ngày thực hiện). Hàm thuần, tách riêng để test được. */
export const dayAfter = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
