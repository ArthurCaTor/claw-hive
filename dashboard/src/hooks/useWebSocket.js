// WebSocket hook for real-time agent updates
import { useEffect, useRef, useState } from 'react';

const WS_URL = import.meta.env.PROD 
  ? `ws://${window.location.host}/ws` 
  : 'ws://localhost:8080/ws';

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onerror = (e) => {
        setError(e);
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };
    } catch (err) {
      setError(err.message);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  };

  const send = (data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  return { connected, error, send, reconnect: connect };
}

// WebSocket context for app-wide connection
import { createContext, useContext } from 'react';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children, onMessage }) {
  const ws = useWebSocket(onMessage);
  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketConnection() {
  return useContext(WebSocketContext);
}

export default useWebSocket;
