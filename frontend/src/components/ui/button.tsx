import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// shadcn/ui Button, chỉnh variant theo .btn trong prototype
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-[color,background-color,border-color,box-shadow,filter] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border border-primary hover:brightness-110',
        outline: 'border border-line bg-surface text-ink hover:border-ink',
        secondary: 'border border-transparent bg-accent-soft text-primary hover:border-primary',
        success: 'border border-sage bg-sage text-white hover:brightness-110',
        destructive: 'border border-destructive bg-destructive text-destructive-foreground hover:brightness-110',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline underline-offset-[3px] hover:brightness-110',
      },
      size: {
        default: 'min-h-[38px] px-3.5 py-2',
        sm: 'min-h-8 px-2.5 py-1 text-[13px]',
        lg: 'min-h-12 px-5 py-2.5 rounded-xl',
        icon: 'size-[34px] p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
