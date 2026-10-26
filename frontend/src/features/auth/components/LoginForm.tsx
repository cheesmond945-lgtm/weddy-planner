import { useState, type ChangeEvent, type FormEvent } from 'react'
import { isMock } from '@/api'
import { FormError } from '@/components/FormField'
import { MOCK_PASSWORD } from '@/mocks/auth'
import type { Session } from '@/types/auth'
import { useLogin } from '../hooks'
import { loginSchema, validate, type FieldErrors } from '../schemas'
import { AuthField, AuthSubmit } from './AuthField'

interface LoginFormProps {
  onSuccess: (session: Session) => void
}

type Values = { identifier: string; password: string }

/** Đăng nhập (1.2). Ô đầu ghi "Email" nhưng vẫn nhận số điện thoại / tên đăng nhập như BE cho phép. */
export function LoginForm({ onSuccess }: LoginFormProps) {
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
      <AuthField
        label="Email"
        autoComplete="username"
        inputMode="email"
        placeholder="Nhập email của bạn..."
        value={values.identifier}
        onChange={change('identifier')}
        error={errors.identifier}
        autoFocus
      />
      <AuthField
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        placeholder="Nhập mật khẩu..."
        value={values.password}
        onChange={change('password')}
        error={errors.password}
      />
      <FormError message={login.error?.message} />

      {isMock('auth') && (
        <p className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-[13px]">
          Dữ liệu giả: <b>minh.anh@example.com</b> (cặp đôi), <b>vendor@example.com</b>, <b>admin@example.com</b>. Mật khẩu{' '}
          <b>{MOCK_PASSWORD}</b>.
        </p>
      )}

      <AuthSubmit disabled={login.isPending}>{login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}</AuthSubmit>
    </form>
  )
}
