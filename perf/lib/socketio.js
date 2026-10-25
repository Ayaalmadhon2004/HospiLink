// perf/lib/socketio.js
//
// A minimal socket.io v4 client over k6's WebSocket, enough for the fan-out test: engine.io handshake, auth packet, event
// packets and heartbeats. Protocol: engine.io packet '0' open, '2' ping, '3' pong, '4' message; socket.io '0' CONNECT, '2' EVENT.
//   server -> 0{"sid":...,"pingInterval":..}      client -> 40{"token":"<jwt>"}      server -> 40{"sid":...} or 44{"message":...}
//   server -> 42["event", payload]                client -> 42["event", arg]         server -> 2 (ping)  client -> 3
import ws from 'k6/ws';
import { BASE_URL, ORIGIN } from './config.js';

const WS_URL = `${BASE_URL.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`;

/**
 * Connects, authenticates and calls `onReady(socket)`; `onEvent(name, payload)` receives every server event.
 * Returns when the connection closes. `onReady` may call socket.emit(name, ...args) and socket.close().
 */
export const connect = (token, { onReady, onEvent, onRefused, maxMs }) => {
  const result = ws.connect(WS_URL, { headers: { Origin: ORIGIN } }, (socket) => {
    const api = {
      emit: (name, arg) => socket.send(`42${JSON.stringify(arg === undefined ? [name] : [name, arg])}`),
      close: () => socket.close(),
    };
    socket.on('message', (msg) => {
      if (msg[0] === '0') {
        socket.send(`40${JSON.stringify({ token })}`); // socket.io CONNECT with the JWT as auth payload
      } else if (msg === '2') {
        socket.send('3'); // engine.io ping -> pong
      } else if (msg.indexOf('40') === 0) {
        if (onReady) onReady(api);
      } else if (msg.indexOf('44') === 0) {
        if (onRefused) onRefused(msg.slice(2));
        socket.close();
      } else if (msg.indexOf('42') === 0) {
        const parsed = JSON.parse(msg.slice(2));
        if (onEvent) onEvent(parsed[0], parsed[1], api);
      }
    });
    socket.setTimeout(() => socket.close(), maxMs); // never hang a VU
  });
  return result;
};
