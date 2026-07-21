FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
ENV NODE_ENV=production
ENV VITE_API_BASE_URL=/api
RUN npm run build

RUN mkdir -p /app/site \
  && cp -r dist/output/. /app/site/ \
  && if [ -d dist/output_resource ]; then cp -r dist/output_resource/. /app/site/; fi \
  && if [ -d dist/output_static ]; then mkdir -p /app/site/static && cp -r dist/output_static/. /app/site/static/; fi

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/site/ /usr/share/nginx/html/

EXPOSE 80
