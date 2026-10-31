FROM node:22-bookworm-slim
WORKDIR /srv/atlas
ENV CI=true CLOUDFLARE_CF_FETCH_ENABLED=false WRANGLER_SEND_METRICS=false WRANGLER_WRITE_LOGS=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN ATLAS_DEPLOY_TARGET=vps npm run build && node scripts/check-vps-build.mjs
ENV NODE_ENV=production ATLAS_DATA_DIR=/atlas-data ATLAS_ENV_FILE=/run/atlas/environment.json VINEXT_TRUSTED_HOSTS=atlasmarket.uz,www.atlasmarket.uz
USER node
EXPOSE 3000
CMD ["node","node_modules/vinext/dist/cli.js","start","--port","3000","--hostname","0.0.0.0"]
