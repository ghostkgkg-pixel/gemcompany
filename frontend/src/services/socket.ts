import { io } from 'socket.io-client';
import { useGameStore } from '../store/useGameStore';

const SOCKET_URL = 'http://localhost:8000';

// Standard path for Socket.io is /socket.io/
export const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'],
});

let listenersAttached = false;

export const initSocket = () => {
  if (listenersAttached) return;

  socket.on('connect', () => {
    console.log('Connected to server via Socket.io');
  });

  socket.on('map_update', (mapData) => {
    console.log('Map update received:', mapData);
    useGameStore.getState().setMap(mapData);
  });

  socket.on('agents_update', (agents) => {
    console.log('Agents update received:', agents);
    useGameStore.getState().setAgents(agents);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  listenersAttached = true;
};
