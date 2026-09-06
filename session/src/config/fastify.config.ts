export = {
  host: process.env.DARWIN_FASTIFY_HOST || '0.0.0.0',
  port: Number(process.env.DARWIN_FASTIFY_PORT) || 8080
}
