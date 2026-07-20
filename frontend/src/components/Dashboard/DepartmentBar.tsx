export const DepartmentBar = ({ title, current, max }: any) => (
  <div className="mb-4">
    <div className="flex justify-between text-sm mb-1 font-medium text-gray-700">
      <span>{title}</span>
      <span>{current} / {max}</span>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div 
        className="bg-teal-600 h-2 rounded-full transition-all duration-500" 
        style={{ width: `${(current / max) * 100}%` }}
      />
    </div>
  </div>
);