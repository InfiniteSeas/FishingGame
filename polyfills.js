


const { TextDecoder, TextEncoder } = require('util');
const { Blob, File } = require('buffer');

// Adding polyfill for ReadableStream using built-in streams module
const { Readable } = require('stream');

class ReadableStreamPolyfill extends Readable {
  constructor(opts) {
    super(opts);
  }

  _read(size) {
    // Noop
  }
}

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
global.ReadableStream = ReadableStreamPolyfill;

const fetchPolyfill = async () => {
  const fetchModule = await import('node-fetch');
  global.fetch = fetchModule.default;
  global.Headers = fetchModule.Headers;
  global.FormData = fetchModule.FormData;
  global.Request = fetchModule.Request;
  global.Response = fetchModule.Response;
};

module.exports = fetchPolyfill;
