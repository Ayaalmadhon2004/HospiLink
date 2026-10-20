interface StatCardProps {
  title: string;
  value: string;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
  icon?: string;
}

const StatCard = ({ title, value, hint, trend, trendUp, icon }: StatCardProps) => {
  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">{title}</h3>
        {icon && <span>{icon}</span>}
      </div>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      {trend && (
        <p className={`text-sm mt-1 ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
          {trend}
        </p>
      )}
    </div>
  );
};

export default StatCard;
