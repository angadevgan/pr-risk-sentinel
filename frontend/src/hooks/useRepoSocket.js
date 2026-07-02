import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export function useRepoSocket(repoId, onPRScored) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!repoId) return;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe:repo', repoId);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('pr:scored', (data) => {
      if (onPRScored) onPRScored(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [repoId]);

  return { connected };
}
