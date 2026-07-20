import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Map, FileText, LogOut, Menu, X, Users, ChevronRight, ChevronLeft, Calculator, CalendarDays, Receipt } from 'lucide-react';


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const navItems = [
    { to: '/admin', icon: Home, label: 'לוח בקרה ראשי' },
    { to: '/admin/trips', icon: Map, label: 'ניהול טיולים' },
    { to: '/admin/clients', icon: Users, label: 'לקוחות ויתרות' },
    { to: '/admin/reports', icon: FileText, label: 'דוחות שטח' },
    { to: '/admin/matrix', icon: CalendarDays, label: 'מטריצת משמרות' },
    { to: '/admin/payroll', icon: Calculator, label: 'ניהול שכר' },
    { to: '/admin/billing', icon: Receipt, label: 'דוח חיובים' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col bg-slate-900 text-white shadow-xl z-10 transition-all duration-300 relative ${isMinimized ? 'w-20' : 'w-72'}`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="absolute -left-3 top-8 bg-blue-600 text-white p-1 rounded-full shadow-lg hover:bg-blue-500 transition-colors z-50"
        >
          {isMinimized ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className={`p-6 border-b border-slate-800 flex items-center ${isMinimized ? 'justify-center px-0' : 'justify-start'} h-20 transition-all`}>
          {isMinimized ? (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">י</div>
          ) : (
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white text-sm">יהב</div>
              הצלה<span className="text-blue-300 font-light"> בטוחה</span>
            </h1>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to}
              end={item.to === '/admin'}
              title={isMinimized ? item.label : undefined}
              className={({ isActive }) => 
                `flex items-center gap-3 py-3 rounded-xl font-bold transition-all ${isMinimized ? 'justify-center px-0' : 'px-4'} ${
                  isActive ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={22} className={isMinimized ? '' : 'stroke-[2.5px]'} />
              {!isMinimized && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            title={isMinimized ? 'התנתק' : undefined}
            className={`flex items-center gap-3 w-full py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-bold transition-colors ${isMinimized ? 'justify-center px-0' : 'px-4'}`}
          >
            <LogOut size={22} className={isMinimized ? '' : 'stroke-[2.5px]'} />
            {!isMinimized && <span>התנתק מהמערכת</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 md:hidden ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b flex items-center justify-between">
          <h1 className="text-xl font-black text-blue-700">יהב הצלה</h1>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-500 bg-gray-100 p-2 rounded-full"><X size={20}/></button>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                  isActive ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                }`
              }
            >
              <item.icon size={22} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t mt-auto">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full py-3 px-4 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-colors"
          >
            <LogOut size={22} />
            <span>התנתק מהמערכת</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar for mobile */}
        <header className="bg-white shadow-sm border-b border-gray-200 p-4 flex items-center justify-between md:hidden z-10">
          <button onClick={() => setSidebarOpen(true)} className="p-2 bg-gray-100 rounded-lg text-gray-700">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-black text-blue-700">יהב הצלה בטוחה</h1>
          <div className="w-10"></div> {/* Spacer */}
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
