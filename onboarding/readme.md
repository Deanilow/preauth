# Darwin Microservice

##  App structure
This generated project contains the following structure:

```yaml
.
├── .editorconfig      # EditorConfig style defined
├── .eslintrc.js       # Configuration for linter
├── .git/              # Git control version folder
├── .gitignore         # Files to ignore in git
├── .npmrc             # NPM configuration file
├── api
│   └── swagger          # API Documentation

├── src/               # Source code of application
│   ├── config/          # Folder to store configurations, variables, etc.


│   ├── controllers/   # Folder that contains the aplication controllers.
│   ├── routes/      # Routes of the application


│   └── server/          # Define server-side startup point
├── package-lock.json  # Automatically generated for any operations where npm
│                      # modifies either the node_modules tree, or package.json
├── package.json       # Application dependencies and configuration
├── changelog          # Changelog example
├── readme.md          # Readme example
└── test               # Application tests
```

## How it works

This microservice uses the Darwin Composer to generate a working application. The generator has the following parameters:

- **app**: It is a fastify instance.
- **routes**: This parameter is an Array with all routes. Each element of the array must follow this schema:
- [**darwinConfig**](#darwin-configuration-parameters): It is an object with Darwin Framework configuration.


## Example

```js
const { host, port } = require('../config/fastify.config');
const fastify = require('fastify')();
const { generateFastifyApp } = require('@darwin-node/composer');
const { techLog } = require('@darwin-node/logger');
const routes = require('../routers');
const darwinConfig = require('../config/darwin.config');
const app = generateFastifyApp(fastify, routes, darwinConfig);

app.listen({ host, port }, () => {
  techLog.info('Server listening');
});

```



##  Schema validation

To validate objects schemas [Joi](https://github.com/hapijs/joi) is used. An example is defined at router `tools` folder.

##  Routing

In this microservice, routes are defined in separated folders. For instance, in this example:
+ `index.js`

And referenced in `routes/comment/`

Routes passed to the generator must be declared as an array of routes:
```js
module.exports = [
  {
    route: (app, options, done) => {
      app.route({
        method: 'your method',
        url: 'your endpoint',
        handler: (req, res) => {
          /* code */
        }
      });
      done();
    },
    prefix: 'your route prefix'
  },
  {
    route: (app, options, done) => {
      app.route({
        method: 'your other method',
        url: 'your other endpoint',
        handler: (req, res) => {
          /* code */
        }
      });
      done();
    },
    prefix: 'your other route prefix'
  }
]
```




##  Testing

For testing purposes [Jest](https://jestjs.io/) is used. Some extra libraries will be helpful:

+ [supertest](https://github.com/visionmedia/supertest), for testing routes.

Try yourself
```sh
npm run test:coverage
```

##  How to run service

Before run start command

```sh
npm run build
```
To generate js files

Run command

```sh
npm run start
```
##  How to develop service

Run command

```sh
npm run dev
```

After running the command, you can test the microservice by making a POST request, with the following JSON body:

```json
{
  "author": "my author",
  "text": "my text",
  "postId": "uctfygvuhijno"
}
```
To this endpoint: http://localhost:8080/api/comment


## Darwin Configuration Parameters

The generated microservice can be configured by passing a darwinConfig Object, containing the following parameters:

| Name                        | Description                                          | Default Value   |
| --------------------------- | -----------------------------------------------------| --------------- |
| `security`                  | Configuration for security middleware                | `{}`            |
| `security.enable`           | Enable or disable security middleware                | `false`         |
| `security.exclude`          | Array of routes excluded from security checks        | `[]`            |
| `security.headers`          | Configuration for header propagation                 | `{}`            |
| `security.headers.enable`   | Enable or disable header propagation                 | `false`         |
| `security.headers.exclude`  | Array of routes excluded from header propagation     | `[]`            |
| `apiSpecification`          | Configuration for documentation route                | `{}`            |
| `apiSpecification.enable`   | Enable or disable documentation route                | `false`         |
| `bodyParsers`               | Adds support to urlencoded and json bodies           | `{}`            |
| `bodyParsers.enable`        | Enable or disable body parser middleware             | `false`         |
| `gracefulShutdown`          | Adds graceful shutdown to running microservice       | `{}`            |
| `gracefulShutdown.enable`   | Enable or disable graceful shutdown                  | `false`         |
| `gracefulShutdown.options`  | Graceful shutdown [options](https://github.com/sebhildebrandt/http-graceful-shutdown/blob/master/README.md#options) | `{}`            |
| `helmet`                    | Sets various HTTP security headers                   | `{}`            |
| `helmet.enable`             | Enable or disable security headers                   | `true`          |
| `hpp`                       | Prevents HTTP parameter pollution                    | `{}`            |
| `hpp.enable`                | Enable or disable HTTP parameter pollution prevention| `true`          |
| `overrideResponse`          | Configuration for Activity Logs.                     | `{}`            |
| `overrideResponse.enable`   | Enable or disable Activity Logs                      | `true`          |
| `requestContext`            | Injects a data repository for the request lifecycle. | `{}`            |
| `requestContext.enable`     | Enable or disable request-context service            | `true`          |

### Example

```js
const prefix = '/api/';
module.exports = {
  bodyParsers: {
    enable: true
  },
  hpp: {
    enable: true
  },
  helmet: {
    enable: true
  },
  requestContext: {
    enable: true
  },
  security: { // this level indicates which module use
    enable: true, // allow to enable security
    exclude: [ // we can exclude some endpoint to the security verification
      `${prefix}/cats/:catId([0-9]{6})`, // example
      `${prefix}/public/mapping/string/only`, // example
      /\/api\/poc\/domain\/.*\/cancel/, // example
      { path: `${prefix}/only/put`, method: 'PUT' } // example
    ],
    headers: {
      propagation: true,
      exclude: [{ // we can exclude header propagation
        endpoint: 'http://127.0.0.1:3001',
        common: false,
        logging: false,
        security: false,
        customHeaders: ['a'] // Whose headers you dont want to propagate from Extra headers context
      }]
    }
  },
  overrideResponse: {
    enable: true
  },
  gracefulShutdown: {
    enable: true,
    options: {
      timeout: 30000
    }
  },
  healthEndpoint: {
    enable: true
  },
  apiSpecification: {
    enable: true
  }
};
```


##  Fastify Environment variables
>To be deployed on Openshift, Fastify requires the following environment variables

| Clave  | Valor (por defecto)  | Description |
|---|---|---|
|DARWIN_FASTIFY_HOST | 0.0.0.0 | IP address where the microservice is located |
|DARWIN_FASTIFY_PORT | 8080 | Port the microservice listens |





