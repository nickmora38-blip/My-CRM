import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppNotification {
  id: string;
  type: 'stale_lead';
  severity: 'high' | 'medium';
  message: string;
  leadId: string;
  leadName: string;
  daysIdle: number;
  createdAt: string;
}

interface NotificationsState {
  items: AppNotification[];
  loading: boolean;
  /** IDs dismissed in this session (cleared on refresh — no persistence needed) */
  dismissed: string[];
}

const initialState: NotificationsState = {
  items: [],
  loading: false,
  dismissed: [],
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<AppNotification[]>) {
      state.items = action.payload;
      state.loading = false;
    },
    setNotificationsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    dismissNotification(state, action: PayloadAction<string>) {
      state.dismissed.push(action.payload);
    },
    clearDismissed(state) {
      state.dismissed = [];
    },
  },
});

export const {
  setNotifications,
  setNotificationsLoading,
  dismissNotification,
  clearDismissed,
} = notificationsSlice.actions;
export default notificationsSlice.reducer;
