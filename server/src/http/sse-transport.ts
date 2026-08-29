import type { Response } from 'express';

import type { SseTransport } from '@/types/chats.types.js';

export function expressSseTransport(res: Response): SseTransport {
  return {
    status: (code) => {
      res.status(code);
    },
    setHeader: (name, value) => {
      res.setHeader(name, value);
    },
    flushHeaders: () => {
      res.flushHeaders();
    },
    write: (chunk) => {
      res.write(chunk);
    },
    end: () => {
      res.end();
    },
    onClose: (listener) => {
      res.on('close', listener);
    },
  };
}
