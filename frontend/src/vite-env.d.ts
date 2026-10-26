/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_USE_MOCK?: string
  /** internal (mặc định): chat trong WebPlan; zalo: mở Zalo của NCC */
  readonly VITE_CHAT_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
