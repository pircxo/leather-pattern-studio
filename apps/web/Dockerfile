FROM node:22-alpine AS build
WORKDIR /srv
COPY apps/web/package.json apps/web/package-lock.json /srv/apps/web/
COPY packages/ui/package.json packages/ui/package-lock.json /srv/packages/ui/
RUN cd /srv/packages/ui && npm ci --no-audit --no-fund
RUN cd /srv/apps/web && npm ci --no-audit --no-fund
COPY packages/ui/src /srv/packages/ui/src
# The build type-checks src/, including tests that import the shared fixtures.
COPY fixtures /srv/fixtures
COPY apps/web /srv/apps/web
WORKDIR /srv/apps/web
RUN npm run build

FROM nginx:1.28-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /srv/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
