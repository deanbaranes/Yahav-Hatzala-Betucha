import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import TripCard from './TripCard';
import { ChevronDown, ChevronUp, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight } from 'lucide-react';

export default function TripFeed() {
  const { data: trips, isLoading } = useQuery<any>({
    queryKey: ['available-trips'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/available');
      return res.data;
    }
  });

  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'accordion' | 'calendar'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const getWeekRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 is Sunday
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getDate()}.${start.getMonth() + 1} - ${end.getDate()}.${end.getMonth() + 1}`;
  };

  const groupedTrips = trips?.reduce((acc: any, trip: any) => {
    const tStart = new Date(trip.start_date);
    const tEnd = trip.end_date ? new Date(trip.end_date) : tStart;
    const actualEnd = tEnd < tStart ? tStart : tEnd;
    
    let curr = new Date(tStart);
    curr.setHours(0,0,0,0);
    const endDay = new Date(actualEnd);
    endDay.setHours(0,0,0,0);
    
    const weeksAdded = new Set<string>();
    while (curr <= endDay) {
      // Create a clean ISO string for getWeekRange without time zone shift issues
      const dateStr = `${curr.getFullYear()}-${String(curr.getMonth()+1).padStart(2,'0')}-${String(curr.getDate()).padStart(2,'0')}T12:00:00`;
      const week = getWeekRange(dateStr);
      if (!weeksAdded.has(week)) {
         weeksAdded.add(week);
         if (!acc[week]) acc[week] = [];
         acc[week].push(trip);
      }
      curr.setDate(curr.getDate() + 1);
    }
    return acc;
  }, {}) || {};

  // Open the first week by default if there are trips
  useEffect(() => {
    const weeks = Object.keys(groupedTrips);
    if (weeks.length > 0 && Object.keys(openWeeks).length === 0) {
      setOpenWeeks({ [weeks[0]]: true });
    }
  }, [groupedTrips, openWeeks]);

  if (isLoading) return <div className="animate-pulse bg-gray-200 h-64 rounded-xl"></div>;

  const toggleWeek = (week: string) => {
    setOpenWeeks(prev => ({ ...prev, [week]: !prev[week] }));
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isSelected = selectedDate.getDate() === i && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      
      const dayStart = new Date(year, month, i, 0, 0, 0);
      const dayEnd = new Date(year, month, i, 23, 59, 59);

      const tripsOnDay = trips?.filter((t: any) => {
        const tStart = new Date(t.start_date);
        const tEnd = t.end_date ? new Date(t.end_date) : tStart;
        const actualEnd = tEnd < tStart ? tStart : tEnd;
        
        return tStart <= dayEnd && actualEnd >= dayStart;
      });
      const hasTrips = tripsOnDay && tripsOnDay.length > 0;
      const allTripsFull = hasTrips && tripsOnDay.every((t: any) => t.assigned_count >= t.capacity);
      
      days.push(
        <button
          key={`day-${i}`}
          onClick={() => setSelectedDate(date)}
          className={`p-2 w-10 h-10 rounded-full flex flex-col items-center justify-center relative mx-auto transition-colors
            ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          <span>{i}</span>
          {hasTrips && !isSelected && <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${allTripsFull ? 'bg-orange-500' : 'bg-blue-500'}`}></div>}
          {hasTrips && isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full absolute bottom-1 opacity-80"></div>}
        </button>
      );
    }
    
    const selDayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
    const selDayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);

    const selectedTrips = trips?.filter((t: any) => {
      const tStart = new Date(t.start_date);
      const tEnd = t.end_date ? new Date(t.end_date) : tStart;
      const actualEnd = tEnd < tStart ? tStart : tEnd;
      
      return tStart <= selDayEnd && actualEnd >= selDayStart;
    }) || [];
    
    return (
      <div className="animate-fade-in">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex justify-between items-center mb-4 px-2">
            {year < new Date().getFullYear() || (year === new Date().getFullYear() && month <= new Date().getMonth()) ? (
              <div className="w-20"></div>
            ) : (
              <button 
                onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} 
                className="text-gray-500 hover:text-blue-600 font-bold p-2 bg-gray-50 rounded-lg flex items-center gap-1 w-20 justify-center"
              >
                <ChevronRight size={16} />
                הקודם
              </button>
            )}
            <span className="font-bold text-lg text-blue-900">{currentMonth.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}</span>
            <button 
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} 
              className="text-gray-500 hover:text-blue-600 font-bold p-2 bg-gray-50 rounded-lg flex items-center gap-1 w-20 justify-center"
            >
              הבא
              <ChevronLeft size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => <div key={day} className="text-xs text-gray-400 font-bold">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days}
          </div>
        </div>
        
        <div>
          <h3 className="font-bold text-gray-700 mb-3 px-1">טיולים ב-{selectedDate.toLocaleDateString('he-IL')}</h3>
          {selectedTrips.length === 0 ? (
            <div className="bg-gray-50 p-6 rounded-xl text-center border border-gray-100">
              <p className="text-gray-500">אין טיולים ביום זה.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedTrips.map((trip: any) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAccordion = () => {
    if (Object.keys(groupedTrips).length === 0) {
      return <p className="text-gray-500 text-center mt-10">אין טיולים זמינים כרגע.</p>;
    }
    
    return (
      <div className="animate-fade-in">
        {Object.entries(groupedTrips).map(([week, weekTrips]: [string, any]) => (
          <div key={week} className="mb-4">
            <button 
              onClick={() => toggleWeek(week)}
              className="w-full bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors p-4 rounded-xl flex justify-between items-center shadow-sm"
            >
              <span className="font-bold text-blue-900 text-lg">שבוע: {week} <span className="text-sm font-normal text-blue-600 bg-white px-2 py-1 rounded-full mr-2">{weekTrips.length} טיולים</span></span>
              {openWeeks[week] ? <ChevronUp className="text-blue-600" /> : <ChevronDown className="text-blue-600" />}
            </button>
            
            {openWeeks[week] && (
              <div className="mt-4 space-y-4 px-1">
                {weekTrips.map((trip: any) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="text-right pb-10" dir="rtl">
      {/* View Toggle */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6 shadow-inner">
        <button
          onClick={() => setViewMode('calendar')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <CalendarIcon size={16} />
          תצוגת יומן
        </button>
        <button
          onClick={() => setViewMode('accordion')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'accordion' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <List size={16} />
          תצוגת שבועות
        </button>
      </div>

      {viewMode === 'calendar' ? renderCalendar() : renderAccordion()}
    </div>
  );
}
