FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate --schema=./prisma/schema.postgresql.prisma
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.postgresql.prisma && node dist/main.js"]
