// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';

const WS_URL = import.meta.env.PROD ? '' : 'ws://localhost:8080';
const RECONNECT_DELAY = 3000;

interface WSMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setConnected(false);
      setTimeout(connect, RECONNECT_DELAY);
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    setWs(socket);
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connect]);

  return { connected };
}

export function useAgentsWebSocket() {
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'connected') {
      setConnected(true);
    } else if (msg.type === 'agents_update') {
      setAgents(msg.agents || []);
      setStats(msg.stats);
    }
  }, []);

  const { connected: wsConnected } = useWebSocket(handleMessage);

  useEffect(() => {
    setConnected(wsConnected);
  }, [wsConnected]);

  return { agents, stats, connected };
}

export function useCapturesWebSocket() {
  const [captures, setCaptures] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'capture') {
      setCaptures(prev => [msg.capture, ...prev].slice(0, 100));
      setLastUpdate(msg.timestamp);
    }
  }, []);

  const { connected: wsConnected } = useWebSocket(handleMessage);

  useEffect(() => {
    setConnected(wsConnected);
  }, [wsConnected]);

  return { captures, lastUpdate, connected };
}
