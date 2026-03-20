FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY apps/redirect-service/package.json apps/redirect-service/
RUN npm install

COPY apps/redirect-service apps/redirect-service
RUN npm run --workspace @url-shortner/redirect-service build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/redirect-service/dist ./apps/redirect-service/dist

CMD ["node", "apps/redirect-service/dist/index.js"]
