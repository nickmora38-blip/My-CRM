import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Task {
  id: string;
  title: string;
  scheduledAt: string;
  notes?: string;
  type: string;
  leadId?: string | null;
  leadOwner?: string;
  assignedTo?: string;
  completed: boolean;
  completedAt?: string | null;
  dueSoonNotifiedAt?: string | null;
  createdAt: string;
}

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
}

const initialState: TasksState = {
  tasks: [],
  loading: false,
  error: null,
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setTasks(state, action: PayloadAction<Task[]>) {
      state.tasks = action.payload;
      state.loading = false;
    },
    addTask(state, action: PayloadAction<Task>) {
      state.tasks.push(action.payload);
    },
    updateTask(state, action: PayloadAction<Task>) {
      const idx = state.tasks.findIndex((t) => t.id === action.payload.id);
      if (idx !== -1) state.tasks[idx] = action.payload;
    },
    setTasksLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setTasks, addTask, updateTask, setTasksLoading } = tasksSlice.actions;
export default tasksSlice.reducer;
