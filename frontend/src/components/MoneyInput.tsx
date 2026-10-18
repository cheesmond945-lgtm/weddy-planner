import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'

interface MoneyInputProps extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
}

/** Ô nhập tiền, tự thêm dấu chấm hàng nghìn khi gõ (fmtMoney trong prototype). Giá trị là số nguyên đồng. */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  return (
    <Input
      inputMode="numeric"
      value={value ? value.toLocaleString('vi-VN') : ''}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      {...props}
    />
  )
}
