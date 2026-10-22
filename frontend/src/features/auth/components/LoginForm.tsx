import { useState, type ChangeEvent, type FormEvent } from 'react'
import { isMock } from '@/api'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { MOCK_PASSWORD } from '@/mocks/auth'
import type { Session } from '@/types/auth'
import { useLogin } from '../hooks'
import { loginSchema, validate, type FieldErrors } from '../schemas'

interface LoginFormProps {
  onSuccess: (session: Session) => void
  onCancel?: () => void
}

type Values = { identifier: string; password: string }

/** Đăng nhập bằng email hoặc số điện thoại (1.2). */
export function LoginForm({ onSuccess, onCancel }: LoginFormProps) {
  const [values, setValues] = useState<Values>({ identifier: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<Values>>({})
  const login = useLogin()

  const change = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const { data, errors } = validate(loginSchema, values)
    setErrors(errors)
    if (data) login.mutate(data, { onSuccess })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField
        label="Email hoặc số điện thoại"
        autoComplete="username"
        value={values.identifier}
        onChange={change('identifier')}
        error={errors.identifier}
        autoFocus
      />
      <FormField
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={change('password')}
        error={errors.password}
      />
      <FormError message={login.error?.message} />

      {isMock('auth') && (
        <p className="rounded-md bg-accent-soft px-3.5 py-2.5 text-[13px]">
          Dữ liệu giả: <b>minh.anh@example.com</b> (cặp đôi), <b>vendor@example.com</b>, <b>admin@example.com</b>. Mật khẩu{' '}
          <b>{MOCK_PASSWORD}</b>.
        </p>
      )}

      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </div>
    </form>
  )
}
