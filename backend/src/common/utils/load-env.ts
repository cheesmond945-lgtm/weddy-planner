// Nạp backend/.env vào process.env (Node >= 20.12). Phải được import đầu tiên trong main.ts.
// Không có file .env thì dùng biến môi trường sẵn có (Docker, CI).
try {
  process.loadEnvFile()
} catch {
  // không có .env
}
