FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY apps/events-worker/package.json apps/events-worker/
RUN npm install

COPY apps/events-worker apps/events-worker
RUN npm run --workspace @url-shortner/events-worker build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/events-worker/dist ./apps/events-worker/dist

CMD ["node", "apps/events-worker/dist/index.js"]
