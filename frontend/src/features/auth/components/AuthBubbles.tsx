/**
 * Bong bóng: vị trí xuất phát theo chiều ngang (% bề rộng màn hình, âm là ngoài mép trái), cỡ (px), thời gian bay (s),
 * độ trễ (s, âm để vừa mở trang đã có sẵn bong bóng giữa đường bay), thời gian lắc (s)
 */
const BUBBLES = [
  { left: -9, size: 46, rise: 19, delay: -3, sway: 4.2 },
  { left: -3, size: 88, rise: 26, delay: -14, sway: 5.6 },
  { left: 3, size: 30, rise: 16, delay: -8, sway: 3.6 },
  { left: 9, size: 62, rise: 23, delay: -19, sway: 4.8 },
  { left: 17, size: 22, rise: 14, delay: -2, sway: 3.2 },
  { left: 22, size: 104, rise: 30, delay: -11, sway: 6.4 },
  { left: 28, size: 38, rise: 18, delay: -15, sway: 4 },
  { left: 33, size: 70, rise: 24, delay: -5, sway: 5.2 },
  { left: 38, size: 34, rise: 17, delay: -12, sway: 3.8 },
  { left: 13, size: 52, rise: 21, delay: -24, sway: 4.6 },
  { left: -6, size: 26, rise: 15, delay: -10, sway: 3.4 },
  { left: 35, size: 120, rise: 34, delay: -26, sway: 7 },
  { left: -10, size: 64, rise: 22, delay: -17, sway: 5 },
  { left: 0, size: 40, rise: 18, delay: -21, sway: 4.4 },
  { left: 6, size: 96, rise: 28, delay: -4, sway: 6 },
  { left: 19, size: 44, rise: 19, delay: -16, sway: 4.2 },
  { left: 25, size: 28, rise: 15, delay: -7, sway: 3.4 },
  { left: 30, size: 84, rise: 25, delay: -20, sway: 5.4 },
  { left: 40, size: 56, rise: 21, delay: -9, sway: 4.6 },
  { left: 12, size: 130, rise: 36, delay: -30, sway: 7.4 },
]

/** Hạt sáng lấp lánh: vị trí (%), cỡ (px), độ trễ (s) */
const GLINTS = [
  { top: 14, left: 30, size: 6, delay: 0 },
  { top: 26, left: 70, size: 4, delay: 1.1 },
  { top: 42, left: 12, size: 5, delay: 2.3 },
  { top: 58, left: 84, size: 7, delay: 0.6 },
  { top: 72, left: 40, size: 4, delay: 1.8 },
  { top: 86, left: 66, size: 6, delay: 2.9 },
  { top: 8, left: 88, size: 5, delay: 1.5 },
  { top: 34, left: 52, size: 3, delay: 2.6 },
]

/** Lớp hiệu ứng trên nền nửa phải: quầng nắng, vệt sáng cầu vồng, hạt lấp lánh (bong bóng ở AuthBubbleFlight). */
export function AuthBubbles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Quầng nắng góc trên và vệt lens flare cầu vồng */}
      <div className="absolute -top-28 -right-28 size-[460px] animate-auth-glow rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.95)_0%,rgb(255_243_207/0.75)_28%,rgb(255_214_140/0.3)_52%,transparent_70%)]" />
      <div className="absolute top-[22%] right-[28%] size-16 rounded-full bg-[radial-gradient(circle,transparent_45%,rgb(255_170_220/0.55)_60%,rgb(140_210_255/0.5)_75%,transparent_82%)]" />
      <div className="absolute top-[30%] right-[22%] size-7 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.9)_0%,rgb(150_230_200/0.6)_55%,transparent_75%)]" />

      {GLINTS.map((g) => (
        <span
          key={`${g.top}-${g.left}`}
          className="absolute animate-auth-twinkle rounded-full bg-white shadow-[0_0_10px_3px_rgb(255_225_150/0.8)]"
          style={{ top: `${g.top}%`, left: `${g.left}%`, width: g.size, height: g.size, animationDelay: `${g.delay}s` }}
        />
      ))}

    </div>
  )
}

/**
 * Bong bóng bay chéo cả màn hình: xuất phát dưới mép dưới, phía bên trái, bay lên phía trên bên phải (auth-drift) và lắc nhẹ.
 * Đặt một lần ở gốc AuthLayout, nằm trên ảnh nhưng dưới thẻ form (thẻ z-[2]).
 */
export function AuthBubbleFlight() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden motion-reduce:hidden">
      {BUBBLES.map((b) => (
        <span
          key={`${b.left}-${b.size}`}
          className="absolute -bottom-36 animate-auth-drift"
          style={{ left: `${b.left}%`, width: b.size, height: b.size, animationDuration: `${b.rise}s`, animationDelay: `${b.delay}s` }}
        >
          <span className="block size-full animate-auth-sway" style={{ animationDuration: `${b.sway}s` }}>
            <span className="auth-bubble block size-full" />
          </span>
        </span>
      ))}
    </div>
  )
}
