// Capture Store - LLM call captures
import { create } from 'zustand';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export const useCaptureStore = create((set, get) => ({
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
      set({ error: err.message, loading: false });
    }
  },
  
  selectCapture: (capture) => set({ selectedCapture: capture }),
  
  clearSelection: () => set({ selectedCapture: null }),
  
  startPolling: (interval = 5000) => {
    get().fetchCaptures();
    return setInterval(() => get().fetchCaptures(), interval);
  },
}));
