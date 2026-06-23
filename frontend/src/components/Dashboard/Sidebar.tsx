const Sidebar = () => {
  const menuItems = [
    { name: 'Overview' },
    { name: 'Patients', badge: '1.2k' },
    { name: 'Beds & Wards' },
    { name: 'Staff & Shifts' },
    { name: 'Appointments' },
    { name: 'Vitals Monitor', badge: '3' },
    { name: 'Incidents', badge: '7' },
    { name: 'Dispatch' },
  ];

  return (
    <aside className="w-64 min-h-screen p-6 bg-hospital-navy text-sidebar-text">
      {/* القسم العلوي (اللوجو) */}
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-8 h-8 rounded-lg bg-medical-teal flex items-center justify-center shadow-lg">
          <span className="text-white font-bold">♥</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white font-sans">CareSync</h2>
      </div>

      {/* القائمة */}
      <nav className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-widest text-sidebar-text/60 font-bold mb-4 px-2">
          Clinical Operations
        </p>
        
        {menuItems.map((item, index) => {
          const isActive = index === 0;
          return (
            <div
              key={item.name}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                isActive 
                  ? 'bg-[#2dd4bf]/20 text-[#2dd4bf] border-l-4 border-[#2dd4bf]' 
                  : 'text-[#ffffff] hover:text-[#2dd4bf] hover:bg-[#ffffff]/5'
              }`}
            >
              <span className="font-sans text-[14px]">{item.name}</span>
              
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-medical-teal/20' : 'bg-white/5'
                }`}>
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;