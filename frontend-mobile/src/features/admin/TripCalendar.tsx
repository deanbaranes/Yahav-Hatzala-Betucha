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

  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const getFullTooltip = (trip: any) => {
    const start = new Date(trip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    const end = trip.end_date ? new Date(trip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}) : 'לא צוין';
    
    let tooltip = `לקוח: ${trip.client?.name || 'לא ידוע'}\nמיקום: ${trip.location}\nשעות: ${start} - ${end}\nסה"כ אנשי צוות דרושים: ${trip.capacity}\n\nצוות ששובץ ומאושר:\n`;
    
    const confirmed = trip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned') || [];
    if (confirmed.length === 0) {
      tooltip += "אין עובדים ששובצו עדיין.\n";
    } else {
      confirmed.forEach((a:any) => {
        tooltip += `- ${a.user?.full_name} (${a.role || 'כללי'})\n`;
      });
    }
    return tooltip;
  };

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
                    title={getFullTooltip(trip)}
                    onClick={() => setSelectedTrip(trip)}
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

      {/* Trip Details Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedTrip(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full animate-fade-in text-right" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-800">{selectedTrip.client?.name || 'לקוח לא ידוע'}</h3>
              <button onClick={() => setSelectedTrip(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <div className="text-blue-600">📍</div>
                <div>
                  <div className="text-xs text-gray-500 font-bold">מיקום הטיול</div>
                  <div className="text-gray-800 font-medium">{selectedTrip.location}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <div className="text-blue-600">⏰</div>
                <div>
                  <div className="text-xs text-gray-500 font-bold">שעות התחלה וסיום</div>
                  <div className="text-gray-800 font-medium">
                    {new Date(selectedTrip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})} - {selectedTrip.end_date ? new Date(selectedTrip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}) : 'לא הוגדר'}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500 font-bold mb-2">צוות מאושר בטיול ({selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length || 0} / {selectedTrip.capacity})</div>
                <div className="space-y-2">
                  {selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length === 0 ? (
                    <div className="text-sm text-red-500 font-medium">עדיין לא שובצו עובדים!</div>
                  ) : (
                    selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').map((a:any) => (
                      <div key={a.id} className="flex justify-between items-center text-sm bg-white p-2 border border-gray-100 rounded shadow-sm">
                        <span className="font-bold text-gray-800">{a.user?.full_name}</span>
                        <span className="text-gray-500 font-medium">{a.role || 'כללי'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setSelectedTrip(null)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors">
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
