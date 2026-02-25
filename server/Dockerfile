FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/dist ./dist
COPY prisma ./prisma
COPY .env.example .env.example
ENV PORT=4000
CMD ["node", "dist/index.js"]
