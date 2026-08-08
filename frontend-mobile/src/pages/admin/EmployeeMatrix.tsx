import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Calendar, ChevronRight, ChevronLeft, LayoutGrid, List, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';

export default function EmployeeMatrix() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('list');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data, isLoading } = useQuery<{ matrix: any[] }>({
    queryKey: ['employee-matrix', month, year],
    queryFn: async () => {
      const res = await axiosClient.get(`/reports/matrix/${year}/${month}`);
      return res.data;
    }
  });

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(year, month);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const handleExport = () => {
    if (!data || !data.matrix) return;
    
    const headers = ['תאריך', ...data.matrix.map((u: any) => u.name)];
    
    const rows = daysArray.map(day => {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).toLocaleDateString('he-IL', { weekday: 'short' });
      
      const row = [`${day}/${month} (${dayOfWeek})`];
      
      data.matrix.forEach((user: any) => {
        const shifts = user.shifts[dateStr];
        if (!shifts || shifts.length === 0) {
          row.push('');
        } else {
          const shiftStr = shifts.map((s: any) => s.role + (s.is_overtime ? ' (נ)' : '')).join(' + ');
          row.push(shiftStr);
        }
      });
      return row;
    });
    
    exportToCSV(`משמרות_${month}_${year}`, headers, rows);
  };

  if (isLoading) return <div className="p-8 text-center">טוען נתונים...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10" dir="rtl">
      <header className="mb-6 relative bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <span className="bg-blue-100 text-blue-700 p-2 rounded-lg shrink-0">
                <Calendar size={28} />
              </span>
              דו"ח משמרות
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-2 font-medium">פריסת עבודה לכלל העובדים בחודש הנבחר.</p>
          </div>
          
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 h-9 sm:h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-sm transition-colors border border-emerald-200 whitespace-nowrap shrink-0"
          >
            <Download size={16} />
            <span className="hidden sm:inline">ייצוא לאקסל</span>
            <span className="sm:hidden">ייצוא</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between px-2 bg-gray-50 h-11 rounded-xl border border-gray-200 min-w-[200px] shrink-0">
            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg shadow-sm text-gray-600 transition-colors"><ChevronRight size={20} /></button>
            <span className="font-black text-sm sm:text-base whitespace-nowrap text-center flex-1">{currentDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}</span>
            <button onClick={nextMonth} className="p-2 hover:bg-white rounded-lg shadow-sm text-gray-600 transition-colors"><ChevronLeft size={20} /></button>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-xl h-11 items-center shrink-0">
            <button 
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-2 px-3 sm:px-4 h-9 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'matrix' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid size={16} /> מטריצה
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 sm:px-4 h-9 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={16} /> רשימה
            </button>
          </div>
        </div>
      </header>

      {viewMode === 'matrix' ? (
        <>
          <div className="sm:hidden bg-blue-50 text-blue-800 p-4 rounded-xl text-center font-bold text-sm mb-4">
            תצוגת המטריצה אינה מותאמת למסכים קטנים, אנא השתמש בתצוגת רשימה (או סובב את המכשיר).
          </div>
          <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto h-[70vh]">
            <table className="text-right border-collapse whitespace-nowrap min-w-full">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-800 text-white">
                  <th className="p-3 font-bold sticky right-0 bg-slate-900 z-30 border-l border-slate-700 min-w-[80px]">תאריך</th>
                  {data?.matrix?.map((user: any) => (
                    <th key={user.id} className="p-3 text-center border-l border-slate-700 font-bold min-w-[120px]">
                      {user.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {daysArray.map(day => {
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  // Get the day of the week in Hebrew
                  const dayOfWeek = new Date(year, month - 1, day).toLocaleDateString('he-IL', { weekday: 'short' });
                  
                  return (
                    <tr key={day} className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${day % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="p-3 font-bold text-gray-800 sticky right-0 z-10 border-l border-gray-200 shadow-sm bg-inherit">
                        {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')} <span className="text-gray-400 text-xs font-normal">({dayOfWeek})</span>
                      </td>
                      {data?.matrix?.map((user: any) => {
                        const shift = user.shifts[dateStr];
                        
                        return (
                          <td key={user.id} className="p-2 border-l border-gray-100 text-center relative group">
                            {shift ? (
                              <div className={`p-1.5 rounded text-sm font-bold border ${shift.overtime > 0 ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                {shift.role}
                                {shift.overtime > 0 && <span className="block text-[10px] text-green-600 mt-0.5">+{shift.overtime} נוספות</span>}
                              </div>
                            ) : (
                              <div className="text-gray-200">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {(!data?.matrix || data.matrix.length === 0) && (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-gray-500 font-medium">
                      לא נמצאו עובדים או משמרות בחודש זה.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.matrix?.filter(u => Object.keys(u.shifts).length > 0).map((user: any) => {
              const shiftsDates = Object.keys(user.shifts).sort();
              const isExpanded = expandedEmployee === user.id;

              return (
                <div key={user.id} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <button 
                    onClick={() => setExpandedEmployee(isExpanded ? null : user.id)}
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
                        {user.name.charAt(0)}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{shiftsDates.length} משמרות החודש</div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-gray-50 border-t border-gray-100 max-h-64 overflow-y-auto space-y-2">
                      {shiftsDates.map(dateStr => {
                        const shift = user.shifts[dateStr];
                        const dateObj = new Date(dateStr);
                        const dayOfWeek = dateObj.toLocaleDateString('he-IL', { weekday: 'short' });
                        const dateFormatted = dateObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

                        return (
                          <div key={dateStr} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-800">{dateFormatted} <span className="text-gray-400 font-normal text-xs">({dayOfWeek})</span></span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-blue-700 text-sm bg-blue-50 px-2 py-0.5 rounded">{shift.role}</span>
                              {shift.overtime > 0 && (
                                <span className="text-xs font-bold text-green-600 mt-1">+{shift.overtime} שעות נוספות</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {(!data?.matrix || data.matrix.filter(u => Object.keys(u.shifts).length > 0).length === 0) && (
              <div className="col-span-1 md:col-span-2 text-center py-10 text-gray-500 font-medium">
                לא נמצאו עובדים עם משמרות בחודש זה.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
