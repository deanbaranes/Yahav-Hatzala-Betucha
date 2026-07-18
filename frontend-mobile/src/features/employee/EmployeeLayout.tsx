import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Map, FilePlus, LogOut } from 'lucide-react';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const navItems = [
    { to: '/employee', icon: Home, label: 'ראשי' },
    { to: '/employee/trips', icon: Map, label: 'טיולים' },
    { to: '/employee/report', icon: FilePlus, label: 'דיווח' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20" dir="rtl">
      {/* Top Header */}
      <header className="bg-white p-4 shadow-sm border-b flex items-center justify-between sticky top-0 z-20">
        <h1 className="text-xl font-black text-blue-600">יהב הצלה - עובד</h1>
        <button onClick={handleLogout} className="text-red-500 bg-red-50 p-2 rounded-full hover:bg-red-100 transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-6">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-50">
        <div className="flex justify-around items-center p-2">
          {navItems.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to}
              end={item.to === '/employee'}
              className={({ isActive }) => 
                `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  isActive ? 'text-blue-600 font-bold transform -translate-y-1' : 'text-gray-500 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={24} className={isActive ? 'stroke-[2.5px]' : ''} />
                  <span className="text-xs">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
