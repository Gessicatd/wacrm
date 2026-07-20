FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=4096
# The lockfile is committed and validated in the repository. Next's automatic
# SWC lockfile patcher performs a registry request during builds and can parse
# a proxy warning as JSON; disable only that nonessential mutation step.
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
EXPOSE 3000
CMD ["npm", "start"]
