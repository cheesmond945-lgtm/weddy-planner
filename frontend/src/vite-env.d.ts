/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** internal (mặc định): chat trong Forever; zalo: mở Zalo của NCC */
  readonly VITE_CHAT_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
