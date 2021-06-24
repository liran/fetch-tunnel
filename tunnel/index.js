const FrameManager = require('./frame');
const Context = require('./context');
const { TransformStream } = require('./stream');
const { createCork } = require('./utils');
const Channel = require('./channel');

class Tunnel {
  listen = {};

  channel = new Channel();

  isServer = false;

  constructor({ isServer = false, readable, writable }) {
    this.isServer = isServer;

    const reader = readable.getReader();
    this.readChunk(reader);
  }

  readChunk = async (reader) => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          this.channel.write(null);
          this.onClose();
          return;
        }
        await this.channel.write(value);
      }
    } catch (error) {
      this.onError(error);
    }
  };

  onHeaderFrame = (frame) => {
    const id = frame.id;
    if (!this.sessions[id]) {
      const ctx = new Context();
      try {
        const text = new TextDecoder().decode(frame.bytes);
        const opts = JSON.parse(text);
        ctx.headers = opts.headers || {};
        ctx.url = opts.url;
        ctx.method = opts.method || 'GET';
        if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
          const { readable, writable } = new TransformStream();
          ctx.body = readable;
          ctx.fetchBodyWriter = writable.getWriter();
        }

        this.sessions[id] = ctx;
        if (this.listen.fetch instanceof Function) this.listen.fetch(ctx);
      } catch (error) {
        console.error(error);
      }
    }
  };

  onFrame = (frame) => {
    switch (frame.type) {
      case 0x1: // header
        this.onHeaderFrame();
        break;
      default:
        break;
    }
  };

  on = (type, cb) => {
    this.listen[type] = cb;
  };

  onError = (error) => {
    console.log(error);
  };

  onClose = () => {
    console.log('normal close tunnel');
  };

  fetch = (url, options) => {};
}

module.exports = Tunnel;
