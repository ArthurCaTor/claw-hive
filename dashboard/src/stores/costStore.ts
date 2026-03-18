// Cost Store - Cost tracking
import { create } from 'zustand';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

interface CostData {
  totalCost?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  currency?: string;
  byModel?: Record<string, { inputCost: number; outputCost: number; totalCost: number }>;
}

interface CostStore {
  costData: CostData | null;
  loading: boolean;
  error: string | null;
  fetchCost: () => Promise<void>;
  startPolling: (interval?: number) => ReturnType<typeof setInterval>;
}

export const useCostStore = create<CostStore>((set) => ({
  costData: null,
  loading: false,
  error: null,
  
  fetchCost: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/cost`);
      const data = await res.json();
      set({ costData: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
  
  startPolling: (interval = 30000) => {
    set({ loading: true });
    fetch(`${API_BASE}/api/cost`)
      .then(res => res.json())
      .then(data => set({ costData: data, loading: false }))
      .catch(err => set({ error: (err as Error).message, loading: false }));
    
    return setInterval(() => {
      fetch(`${API_BASE}/api/cost`)
        .then(res => res.json())
        .then(data => set({ costData: data }))
        .catch(err => console.error('Cost fetch error:', err));
    }, interval);
  },
}));
