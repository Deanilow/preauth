import './gluon.config';
/**
 * Darwinf Config,
 * You can use it to configure:
 * * Security
 * * UI with api specification ([localhost:8080 | host]/api-docs)
 * @returns module darwin config.
 */
export = {
  security: {
    enable: true,
    exclude: [
      '/*api',
      '/verify*',
      '/evaluate*'
    ],
    headers: {
      propagation: false
    }
  },
  healthEndpoint: {
    enable: true
  },
  helmet: {
    enable: true
  },
  gracefulShutdown: {
    enable: true,
    options: {
      timeout: 30000
    }
  },
  graphql: {
    ui: ['playground']
  },
  apiSpecification: {
    enable: true
  },
  overrideResponse: {
    enable: true
  }
};