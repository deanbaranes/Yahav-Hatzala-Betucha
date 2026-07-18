import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react';

export default function EmployeeMatrix() {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  if (isLoading) return <div className="p-8 text-center">טוען נתונים...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10" dir="rtl">
      <header className="mb-6 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="bg-blue-100 text-blue-700 p-2 rounded-lg">
              <Calendar size={28} />
            </span>
            מטריצת משמרות לעובדים
          </h1>
          <p className="text-gray-500 text-base mt-2 font-medium">פריסת ימי עבודה לכלל העובדים בחודש הנבחר.</p>
        </div>
        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl border border-gray-200">
          <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg shadow-sm text-gray-600"><ChevronRight size={20} /></button>
          <span className="font-black text-lg min-w-[120px] text-center">{currentDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-white rounded-lg shadow-sm text-gray-600"><ChevronLeft size={20} /></button>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto h-[70vh]">
          <table className="w-full text-right border-collapse whitespace-nowrap">
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
    </div>
  );
}
