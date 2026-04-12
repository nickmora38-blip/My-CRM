import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { setTasks, addTask, updateTask, Task } from '../store/slices/tasksSlice';
import { tasksAPI, usersAPI } from '../services/api';
import { usePushNotifications } from '../hooks/usePushNotifications';
import Button from '../components/Button';
import Modal from '../components/Modal';

const inputClass =
  'w-full px-3 py-2 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red text-sm placeholder-gray-600';
const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

export default function TasksPage() {
  const dispatch = useDispatch();
  const tasks = useSelector((state: RootState) => state.tasks.tasks);
  const user = useSelector((state: RootState) => state.auth.user);
  const { supported, subscribed, loading: pushLoading, error: pushError, subscribe, unsubscribe } =
    usePushNotifications();

  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', scheduledAt: '', notes: '', assignedTo: '' });
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await tasksAPI.getAll({ completed: showCompleted ? undefined : false });
        dispatch(setTasks(Array.isArray(res.data) ? res.data : (res.data as { tasks?: Task[] }).tasks || []));
      } catch {
        // demo mode
      }
    };
    fetchTasks();
  }, [dispatch, showCompleted]);

  useEffect(() => {
    if (user?.role === 'admin') {
      usersAPI.getAll()
        .then((res) => {
          const data = res.data as { users?: { id: string; name: string }[] };
          setUsers(data.users || []);
        })
        .catch(() => {});
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await tasksAPI.create({
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        notes: form.notes,
        assignedTo: form.assignedTo || undefined,
      });
      const newTask = (res.data as { task: Task }).task;
      dispatch(addTask(newTask));
    } catch {
      // handle gracefully
    }
    setSaving(false);
    setModalOpen(false);
    setForm({ title: '', scheduledAt: '', notes: '', assignedTo: '' });
  };

  const handleComplete = async (task: Task) => {
    try {
      const res = await tasksAPI.complete(task.id);
      dispatch(updateTask((res.data as { task: Task }).task));
    } catch {
      dispatch(updateTask({ ...task, completed: true, completedAt: new Date().toISOString() }));
    }
  };

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const displayTasks = showCompleted ? [...pending, ...completed] : pending;

  return (
    <div className="min-h-screen bg-black pb-20 sm:pb-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Tasks</h1>
            <p className="text-gray-400 text-xs mt-1">
              {pending.length} pending
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>+ New Task</Button>
        </div>

        {/* Push notification status */}
        {supported && (
          <div className="mb-4 p-3 bg-exclusive-black-card border border-exclusive-black-border rounded-lg flex items-center justify-between gap-3">
            <div>
              <p className="text-white text-xs font-medium">
                🔔 Push Notifications
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {subscribed ? 'Enabled — you will be notified when tasks are due.' : 'Enable to receive task reminders on this device.'}
              </p>
              {pushError && <p className="text-red-400 text-xs mt-1">{pushError}</p>}
            </div>
            <button
              onClick={subscribed ? unsubscribe : subscribe}
              disabled={pushLoading}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subscribed
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  : 'bg-exclusive-red text-white hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {pushLoading ? '...' : subscribed ? 'Disable' : 'Enable'}
            </button>
          </div>
        )}

        {/* Filter toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowCompleted(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!showCompleted ? 'bg-exclusive-red text-white' : 'bg-exclusive-black-card text-gray-400 border border-exclusive-black-border'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setShowCompleted(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showCompleted ? 'bg-exclusive-red text-white' : 'bg-exclusive-black-card text-gray-400 border border-exclusive-black-border'}`}
          >
            All
          </button>
        </div>

        {/* Tasks list */}
        <div className="space-y-3">
          {displayTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No tasks. Create one to get started.</p>
            </div>
          ) : (
            displayTasks.map((task) => {
              const isPast = !task.completed && new Date(task.scheduledAt) < new Date();
              const isDueSoon =
                !task.completed &&
                !isPast &&
                (new Date(task.scheduledAt).getTime() - Date.now()) / 60_000 <= 30;
              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-opacity ${
                    task.completed
                      ? 'opacity-50 bg-exclusive-black-card border-exclusive-black-border'
                      : isPast
                      ? 'bg-red-950/30 border-exclusive-red/50'
                      : isDueSoon
                      ? 'bg-yellow-950/20 border-yellow-700/40'
                      : 'bg-exclusive-black-card border-exclusive-black-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {task.title}
                      </p>
                      <p className={`text-xs mt-1 ${isPast && !task.completed ? 'text-exclusive-red font-medium' : 'text-gray-500'}`}>
                        {isPast && !task.completed ? '⚠️ Overdue: ' : ''}
                        {new Date(task.scheduledAt).toLocaleString()}
                      </p>
                      {task.notes && (
                        <p className="text-xs text-gray-600 mt-1 truncate">{task.notes}</p>
                      )}
                    </div>
                    {!task.completed && (
                      <button
                        onClick={() => handleComplete(task)}
                        className="shrink-0 w-8 h-8 rounded-lg bg-green-900/40 hover:bg-green-800/60 text-green-400 flex items-center justify-center transition-colors"
                        aria-label="Mark complete"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create task modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Task">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={labelClass}>Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Task title"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Due Date & Time *</label>
            <input
              required
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className={inputClass}
            />
          </div>
          {user?.role === 'admin' && users.length > 0 && (
            <div>
              <label className={labelClass}>Assign To</label>
              <select
                value={form.assignedTo}
                onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                className={inputClass}
              >
                <option value="">Self</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Optional notes..."
              className={inputClass}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Create Task'}
            </Button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 border border-exclusive-black-border rounded-lg hover:text-white hover:border-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
