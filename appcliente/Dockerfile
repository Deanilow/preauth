FROM registry.global.ccc.srvb.bo.paas.cloudcenter.corp/produban/nodejs-24-puppeteer-ubi9:1.2.6.RELEASE

USER root
ENV APP_HOME=/opt/app
ENV TZ=America/Bogota
ENV NODE_ENV=production
WORKDIR ${APP_HOME}

COPY package.json package-lock.json* ./

RUN mkdir -p ${APP_HOME}/.npm-cache \
 && npm config set cache ${APP_HOME}/.npm-cache --global \
 && npm config set allow-remote all --global \
 && npm ci

COPY . ${APP_HOME}

RUN chown -R 23550:23550 ${APP_HOME}

USER 23550
WORKDIR /opt/produban

ENTRYPOINT ["./control.sh"]
CMD ["start"]