interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ title, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-black border border-exclusive-red/40 rounded-xl p-4 sm:p-5 hover:border-exclusive-red transition-colors duration-200">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xl sm:text-2xl">{icon}</span>
        {trend && (
          <span className={`text-xs font-medium ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-bold text-white mb-1 truncate">{value}</div>
      <div className="text-gray-400 text-xs sm:text-sm">{title}</div>
    </div>
  );
}
