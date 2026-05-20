import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const BOTS_COUNT = 40;

const mobileSockets = [];

function startBots() {
  for (let i = 0; i < BOTS_COUNT; i++) {
    const isATT = i < 20;
    const team = isATT ? 'ATT' : 'DEF';
    const name = `Bot_${team}_${i+1}`;
    
    // Attendre un peu entre les connexions pour ne pas spammer d'un coup
    setTimeout(() => {
      const socket = io(`${SERVER_URL}/mobile`, {
        transports: ['websocket'],
        reconnection: true
      });

      socket.on('connect', () => {
        console.log(`[Bot ${name}] Connected`);
        // Join
        socket.emit('join_game', { name, team });
      });
      
      let lobbyInterval = null;
      let gameInterval = null;

      socket.on('lobby_state', (state) => {
          if (state.roundState === 'LOBBY') {
             // Vote random map and ready up
             socket.emit('vote_map', { mapId: 'random' });
             socket.emit('player_ready', { ready: true });
          }
      });
      
      socket.on('disconnect', () => {
          console.log(`[Bot ${name}] Disconnected`);
      });

      // Actions in game
      setInterval(() => {
        if (!socket.connected) return;
        
        // Random move
        socket.emit('input_move', {
          angle: Math.random() * Math.PI * 2,
          force: Math.random()
        });

        // Random aim
        socket.emit('input_aim', {
          angle: Math.random() * Math.PI * 2
        });

        // Random shoot
        if (Math.random() < 0.2) {
          socket.emit('input_action', { type: 'SHOOT', data: {} });
        }
      }, 200 + Math.random() * 300);

      mobileSockets.push(socket);
    }, i * 100);
  }
}

// But wait, the system can start a real browser to be the display.
startBots();
