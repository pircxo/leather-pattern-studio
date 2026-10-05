FROM node:20-alpine

WORKDIR /srv

# The UI kit is consumed straight from source via a Vite alias (see
# vite.config.ts), so it needs to be present in the image, but it is
# never `npm install`-ed as its own package here — only its source files
# matter to the web app's build.
COPY packages/ui /srv/packages/ui
COPY apps/web/package.json apps/web/package-lock.json* /srv/apps/web/
WORKDIR /srv/apps/web
RUN npm install

COPY apps/web /srv/apps/web

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
