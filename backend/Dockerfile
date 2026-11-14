# Backend Forever (NestJS + Prisma 7). Deploy trên Render/Railway/Fly: biến môi trường đặt ở dashboard, không chép .env vào ảnh.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm i -g npm@11 && npm ci
COPY . .
# prisma.config.ts cần DATABASE_URL lúc generate; chỉ là giá trị giả, không kết nối DB
RUN DATABASE_URL="postgresql://u:p@localhost:5432/db" npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Ho_Chi_Minh
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
