import { cn } from '@/lib/utils'

/**
 * Ghi nguồn Google cho dữ liệu Places hiển thị không kèm bản đồ.
 *
 * TODO(logo Google): thay chữ tạm này bằng logo chính thức theo hướng dẫn ghi nguồn của
 * Google Maps Platform ("Google Maps attribution"), đặt file vào src/assets/ (bản cho nền sáng và
 * nền tối). Không tự vẽ lại logo Google.
 */
export function GoogleAttribution({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center text-muted-foreground', compact ? 'text-[10px]' : 'text-xs', className)} translate="no">
      {compact ? 'Google' : 'Nguồn: Google Maps'}
    </span>
  )
}
