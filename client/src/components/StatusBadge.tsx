interface BadgeProps {
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';
}

const statusConfig: Record<BadgeProps['status'], { label: string; classes: string }> = {
  new: { label: 'New', classes: 'bg-exclusive-red/20 text-exclusive-red border border-exclusive-red/30' },
  contacted: { label: 'Contacted', classes: 'bg-blue-900/40 text-blue-300 border border-blue-700/30' },
  qualified: { label: 'Qualified', classes: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/30' },
  proposal: { label: 'Proposal', classes: 'bg-purple-900/40 text-purple-300 border border-purple-700/30' },
  closed_won: { label: 'Won', classes: 'bg-green-900/40 text-green-300 border border-green-700/30' },
  closed_lost: { label: 'Lost', classes: 'bg-gray-800 text-gray-400 border border-gray-700/30' },
};

export default function StatusBadge({ status }: BadgeProps) {
  const config = statusConfig[status] ?? statusConfig.new;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      {config.label}
    </span>
  );
}
