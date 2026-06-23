import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-clinic-bg p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-hospital-navy">لوحة تحكم HospiLink</h1>
        <p className="text-pulse-text">مرحباً بك في نظام إدارة التقارير الطبية</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* بطاقة إحصائية */}
        <div className="bg-clinic-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold text-hospital-navy">التقارير الجديدة</h3>
          <p className="text-4xl font-bold text-medical-teal mt-2">12</p>
        </div>
        
        <div className="bg-clinic-card p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold text-hospital-navy">المرضى المسجلين</h3>
          <p className="text-4xl font-bold text-medical-teal mt-2">150</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;