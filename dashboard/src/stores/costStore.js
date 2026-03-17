// Cost Store - Cost tracking
import { create } from 'zustand';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export const useCostStore = create((set) => ({
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
      set({ error: err.message, loading: false });
    }
  },
  
  startPolling: (interval = 30000) => {
    set({ loading: true });
    // Initial fetch
    fetch(`${API_BASE}/api/cost`)
      .then(res => res.json())
      .then(data => set({ costData: data, loading: false }))
      .catch(err => set({ error: err.message, loading: false }));
    
    return setInterval(() => {
      fetch(`${API_BASE}/api/cost`)
        .then(res => res.json())
        .then(data => set({ costData: data }))
        .catch(err => console.error('Cost fetch error:', err));
    }, interval);
  },
}));
