import type { ServerWebSocket } from 'bun';
import { nanoid } from './src/main';

const peers = new Map<string, ServerWebSocket<unknown>>();

const server = Bun.serve({
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/signaller') {
      const ok = server.upgrade(req);
      if (ok) return;
      return new Response('WebSocket Upgrade Failed:', { status: 500 });
    }
    return new Response('404: Not Found!');
  },
  port: 3000,
  websocket: {
    open(ws) {
      let peerId;
      do { peerId = nanoid() } while (peers.has(peerId));
      ws.send(JSON.stringify({ type: 'registered', id: peerId }));
      peers.set(peerId, ws);
      console.log('新客户端连接:', peerId);
    },
    message(ws, message) {
      const data = JSON.parse(typeof message === 'string' ? message : message.toString());
      const { type, peerId, targetId, payload } = data;

      if (type === 'offer' || type === 'answer' || type === 'candidate') {
        const target = peers.get(targetId);
        if (target) {
          target.send(JSON.stringify({ type, peerId, payload }));
        } else {
          ws.send(JSON.stringify({ error: `Peer ${targetId} not found!` }));
        }
      }
    },
    close(ws) {
      // 客户端断开时从 peers 中删除
      peers.forEach((socket, id) => {
        if (socket === ws) {
          peers.delete(id);
          console.log(`客户端[${id}]断开连接`);
        }
      });
    }
  },
});

console.log(`Listening on ws://${server.hostname}:${server.port}`);
