import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Ghép className, class Tailwind sau ghi đè class trước (chuẩn shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
