/** Khóa cache React Query của thông báo (theo người dùng). */
export const notificationKeys = {
  all: (userId: string | undefined) => ['notifications', userId] as const,
  list: (userId: string | undefined) => ['notifications', userId, 'list'] as const,
  unread: (userId: string | undefined) => ['notifications', userId, 'unread'] as const,
}
