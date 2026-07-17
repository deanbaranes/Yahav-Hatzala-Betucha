import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function TripCalendar({ trips }: { trips: any[] }) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday

  // Group trips by date
  const tripsByDate = useMemo(() => {
    const map = new Map<number, any[]>();
    trips.forEach(trip => {
      const d = new Date(trip.start_date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(trip);
      }
    });
    return map;
  }, [trips, year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const toggleBillingMutation = useMutation({
    mutationFn: async (tripId: string) => {
      await axiosClient.put(`/trips/${tripId}/mark-billed`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
    }
  });

  const getTripColor = (trip: any) => {
    if (trip.is_billed) return 'bg-red-500 text-white hover:bg-red-600 border border-red-600';
    
    // Check if fully staffed
    const confirmedCount = trip.assignments?.filter((a: any) => a.is_confirmed && a.status === 'assigned').length || 0;
    const isFullyStaffed = trip.capacity > 0 && confirmedCount >= trip.capacity;

    if (isFullyStaffed) return 'bg-blue-500 text-white hover:bg-blue-600 border border-blue-600';
    return 'bg-green-500 text-white hover:bg-green-600 border border-green-600';
  };

  const getTripLabel = (trip: any) => {
    const confirmedCount = trip.assignments?.filter((a: any) => a.is_confirmed && a.status === 'assigned').length || 0;
    const missing = trip.capacity - confirmedCount;
    const name = trip.client?.name || trip.location;
    
    if (trip.is_billed) return `${name} (חויב)`;
    if (missing <= 0) return `${name} (מלא)`;
    return `${name} (חסרים ${missing})`;
  };

  // Generate blank cells for padding
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  // Generate days
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" dir="rtl">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">
            {currentDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold justify-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> שובץ במלואו</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> חסרים עובדים</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> חויב (נשלחה חשבונית)</span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-100">
        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-bold text-gray-600 border-l last:border-l-0 border-gray-200">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {blanks.map(b => (
          <div key={`blank-${b}`} className="min-h-[120px] bg-gray-50/50 border-l border-b border-gray-100"></div>
        ))}

        {days.map(day => {
          const dayTrips = tripsByDate.get(day) || [];
          return (
            <div key={day} className="min-h-[120px] p-1 border-l border-b border-gray-100 relative group hover:bg-gray-50 transition-colors">
              <span className={`inline-block font-bold text-sm w-7 h-7 text-center leading-7 rounded-full mb-1 ${
                new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-500'
              }`}>
                {day}
              </span>
              
              <div className="flex flex-col gap-1">
                {dayTrips.map(trip => (
                  <div 
                    key={trip.id} 
                    className={`text-xs px-1.5 py-1 rounded shadow-sm font-semibold truncate cursor-pointer transition-all flex justify-between items-center ${getTripColor(trip)}`}
                    title={getTripLabel(trip)}
                  >
                    <span className="truncate">{getTripLabel(trip)}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`האם לסמן את הטיול ב-${trip.location} כ${trip.is_billed ? 'לא חויב' : 'חויב (חשבונית הופקה)'}?`)) {
                          toggleBillingMutation.mutate(trip.id);
                        }
                      }}
                      className="mr-1 hover:scale-125 transition-transform"
                      title="סמן הפקת חשבונית"
                    >
                      <CheckCircle2 size={12} className={trip.is_billed ? 'text-red-200' : 'text-white/70'} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
