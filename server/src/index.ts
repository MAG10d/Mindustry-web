import 'dotenv/config';
import { App } from 'uWebSockets.js';
import { SimulationEngine } from '@mindustry/simulation';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const simulation = new SimulationEngine();

App().ws('/*', {
  open: (ws) => {
    console.log('A WebSocket connected!');
  },
  message: (ws, message, isBinary) => {
    /* Ok is false if backpressure was built up, wait for drain */
    let ok = ws.send(message, isBinary);
  },
  drain: (ws) => {
    console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws, code, message) => {
    console.log('WebSocket closed');
  }
}).listen(port, (token) => {
  if (token) {
    console.log('Listening to port ' + port);
  } else {
    console.log('Failed to listen to port ' + port);
  }
});
