// Agent Store - Global agent state
import { create } from 'zustand';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export const useAgentStore = create((set, get) => ({
  agents: [],
  selectedAgent: null,
  loading: false,
  error: null,
  
  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      set({ agents: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
  
  selectAgent: (agent) => set({ selectedAgent: agent }),
  
  clearSelection: () => set({ selectedAgent: null }),
  
  // Auto-refresh
  startPolling: (interval = 15000) => {
    get().fetchAgents();
    return setInterval(() => get().fetchAgents(), interval);
  },
}));
