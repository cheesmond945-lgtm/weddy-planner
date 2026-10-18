import * as React from 'react'
import { cn } from '@/lib/utils'

// shadcn/ui Input, chỉnh theo ô nhập trong prototype
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'w-full min-w-0 rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted-foreground',
        'focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
