const http = require('node:http');

/**
 * Creates a lightweight mock Express-compatible Response object for controller unit tests.
 */
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    sentBuffer: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      if (Buffer.isBuffer(payload)) {
        this.sentBuffer = payload;
      } else {
        this.body = payload;
      }
      return this;
    }
  };
  return res;
}

/**
 * Creates a lightweight mock Request object.
 */
function createMockReq({ body = {}, params = {}, query = {}, headers = {}, user = undefined } = {}) {
  return {
    body,
    params,
    query,
    headers,
    user
  };
}

/**
 * Starts an isolated ephemeral local HTTP server on an OS-assigned port (127.0.0.1:0)
 * for repeatable request/monitoring/simulation tests without touching production or external APIs.
 */
async function startLocalTestServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    port: address.port,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}

module.exports = {
  createMockRes,
  createMockReq,
  startLocalTestServer
};
