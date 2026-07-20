interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon?: string;
}

const StatCard = ({ title, value, trend, trendUp, icon }: StatCardProps) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-gray-500">{title}</h3>
        {icon && <span>{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {trend && (
        <p className={`text-sm ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
          {trend}
        </p>
      )}
    </div>
  );
};

export default StatCard;