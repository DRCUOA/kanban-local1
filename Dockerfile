FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json ./
COPY client/ client/
COPY server/ server/
COPY shared/ shared/
COPY script/ script/
COPY migrations/ migrations/
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./
COPY --chown=app:app migrations/ ./migrations/
USER app
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
