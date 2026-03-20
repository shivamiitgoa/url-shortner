FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY apps/api-service/package.json apps/api-service/
RUN npm install

COPY apps/api-service apps/api-service
RUN npm run --workspace @url-shortner/api-service build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api-service/dist ./apps/api-service/dist

CMD ["node", "apps/api-service/dist/index.js"]
