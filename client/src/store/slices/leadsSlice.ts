import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';
  source: string;
  notes: string;
  createdAt: string;
  homeType?: string;
  moveDate?: string;
  origin?: string;
  destination?: string;
  estimatedValue?: number;
}

interface LeadsState {
  leads: Lead[];
  loading: boolean;
  error: string | null;
}

const initialState: LeadsState = {
  leads: [],
  loading: false,
  error: null,
};

const leadsSlice = createSlice({
  name: 'leads',
  initialState,
  reducers: {
    setLeads(state, action: PayloadAction<Lead[]>) {
      state.leads = action.payload;
      state.loading = false;
      state.error = null;
    },
    addLead(state, action: PayloadAction<Lead>) {
      state.leads.unshift(action.payload);
    },
    updateLead(state, action: PayloadAction<Lead>) {
      const idx = state.leads.findIndex((l) => l.id === action.payload.id);
      if (idx !== -1) state.leads[idx] = action.payload;
    },
    deleteLead(state, action: PayloadAction<string>) {
      state.leads = state.leads.filter((l) => l.id !== action.payload);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setLeadsError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { setLeads, addLead, updateLead, deleteLead, setLoading, setLeadsError } = leadsSlice.actions;
export default leadsSlice.reducer;
