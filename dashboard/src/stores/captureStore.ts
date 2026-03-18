// Capture Store - LLM call captures
import { create } from 'zustand';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

interface Capture {
  id: number;
  timestamp: string;
  model?: string;
  tokens?: { input: number; output: number };
  latency_ms?: number;
  status?: number;
}

interface CaptureStore {
  captures: Capture[];
  selectedCapture: Capture | null;
  loading: boolean;
  error: string | null;
  fetchCaptures: (limit?: number) => Promise<void>;
  selectCapture: (capture: Capture) => void;
  clearSelection: () => void;
  startPolling: (interval?: number) => ReturnType<typeof setInterval>;
}

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  captures: [],
  selectedCapture: null,
  loading: false,
  error: null,
  
  fetchCaptures: async (limit = 50) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/debug-proxy/captures?limit=${limit}`);
      const data = await res.json();
      set({ captures: data.captures || data || [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  
  selectCapture: (capture) => set({ selectedCapture: capture }),
  
  clearSelection: () => set({ selectedCapture: null }),
  
  startPolling: (interval = 5000) => {
    get().fetchCaptures();
    return setInterval(() => get().fetchCaptures(), interval);
  },
}));
