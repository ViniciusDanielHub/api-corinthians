FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npm ci
COPY src ./src
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 3010
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
