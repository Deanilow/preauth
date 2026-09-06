FROM registry.global.ccc.srvb.bo.paas.cloudcenter.corp/produban/nodejs-24-ubi9:1.2.10.RELEASE

USER root
ENV APP_HOME=/opt/app
WORKDIR ${APP_HOME}

# Copia primero manifests para aprovechar cache de capas
COPY package.json package-lock.json* ./

# See full error output
RUN npm ci --verbose 2>&1 | tee npm-debug.log

# Cache de npm en una ruta controlada (no depende de /opt/app-root/src)
#RUN mkdir -p ${APP_HOME}/.npm-cache \
# && npm config set cache ${APP_HOME}/.npm-cache --global \
# && npm ci

# Copia el resto del código
COPY . ${APP_HOME}

# Compila TypeScript: src/**/*.ts -> app/**/*.js  (rootDir="./src" outDir="./app")
RUN npm run build

# Permisos para ejecutar como 23550
RUN chown -R 23550:23550 ${APP_HOME}

USER 23550
WORKDIR /opt/produban

ENTRYPOINT ["./control.sh"]
CMD ["start"]