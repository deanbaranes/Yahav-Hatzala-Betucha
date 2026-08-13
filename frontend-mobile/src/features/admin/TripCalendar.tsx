import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, CheckCircle2, Download } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import SmartClientInput from './SmartClientInput';
import AssignEmployeeForm from './AssignEmployeeForm';
import CreateManualTripModal from './CreateManualTripModal';
import TripDetailsModal from './TripDetailsModal';
import { exportToCSV } from '../../utils/csvExport';

const AVAILABLE_ROLES = ["מע\"ר", "חובש", "פראמדיק", "שומר לילה", "מע\"ר חמוש", "חובש חמוש", "מאבטח"];


export default function TripCalendar({ trips }: { trips: any[] }) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/employees');
      return res.data;
    }
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday

  const [searchTerm, setSearchTerm] = useState('');

  // Group trips by date
  const tripsByDate = useMemo(() => {
    const map = new Map<number, any[]>();
    trips.forEach(trip => {
      if (searchTerm) {
        const nameMatch = (trip.client?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const locMatch = (trip.location || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!nameMatch && !locMatch) return;
      }

      const start = new Date(trip.start_date);
      const end = trip.end_date ? new Date(trip.end_date) : start;
      const actualEnd = end < start ? start : end;

      const currentMonthStart = new Date(year, month, 1);
      const currentMonthEnd = new Date(year, month + 1, 0, 23, 59, 59);

      if (start <= currentMonthEnd && actualEnd >= currentMonthStart) {
        let iter = new Date(start);
        iter.setHours(0, 0, 0, 0); 
        const endDay = new Date(actualEnd);
        endDay.setHours(0, 0, 0, 0);

        while (iter <= endDay) {
          if (iter.getFullYear() === year && iter.getMonth() === month) {
            const day = iter.getDate();
            if (!map.has(day)) map.set(day, []);
            map.get(day)!.push(trip);
          }
          iter.setDate(iter.getDate() + 1);
        }
      }
    });
    return map;
  }, [trips, year, month, searchTerm]);

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

  const getTripColor = (trip: any): { className: string; style?: React.CSSProperties } => {
    const baseClasses = "text-[9px] md:text-xs px-0.5 py-0.5 md:px-1.5 md:py-1 rounded-sm shadow-sm font-semibold cursor-pointer transition-all flex justify-between items-center leading-tight overflow-hidden";
    
    // 1. Highest Priority: Billed (Invoice Produced) -> RED
    if (trip.is_billed) return { className: `bg-red-500 text-white hover:bg-red-600 border border-red-600 ${baseClasses}` };
    
    // 2. Second Priority: Manual Color Override
    if (trip.color) {
      return { className: `text-white ${baseClasses}`, style: { backgroundColor: trip.color, borderColor: trip.color } };
    }
    
    // 3. Auto Colors based on staffing
    const confirmedCount = trip.assignments?.filter((a: any) => a.is_confirmed && a.status === 'assigned').length || 0;
    const isFullyStaffed = trip.capacity > 0 && confirmedCount >= trip.capacity;
    if (isFullyStaffed) return { className: `bg-blue-500 text-white hover:bg-blue-600 border border-blue-600 ${baseClasses}` };
    return { className: `bg-green-500 text-white hover:bg-green-600 border border-green-600 ${baseClasses}` };
  };

  const getTripLabelMobile = (trip: any) => {
    let name = trip.client?.name === 'לקוח כללי' ? trip.location : (trip.client?.name || trip.location);
    if (trip.notes) name = `${name} (${trip.notes})`;
    return name;
  };

  const getTripLabelDesktop = (trip: any) => {
    const confirmedCount = trip.assignments?.filter((a: any) => a.is_confirmed && a.status === 'assigned').length || 0;
    const missing = trip.capacity - confirmedCount;
    let name = trip.client?.name === 'לקוח כללי' ? trip.location : (trip.client?.name || trip.location);
    if (trip.notes) name = `${name} (${trip.notes})`;
    
    if (trip.is_billed) return `${name} (חויב)`;
    if (trip.capacity === 0) return name;
    if (missing <= 0) return `${name} (מלא)`;
    return `${name} (חסרים ${missing})`;
  };

  // Generate blank cells for padding
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  // Generate days
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [creatingTripDate, setCreatingTripDate] = useState<Date | null>(null);



  const getFullTooltip = (trip: any) => {
    const start = new Date(trip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    const end = trip.end_date ? new Date(trip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}) : 'לא צוין';
    
    let tooltip = `לקוח: ${trip.client?.name === 'לקוח כללי' ? 'מיובא מיומן גוגל' : (trip.client?.name || 'לא ידוע')}\n`;
    if (trip.notes) tooltip += `הערות: ${trip.notes}\n`;
    tooltip += `מיקום/שם הטיול: ${trip.location}\nשעות: ${start} - ${end}\nסה"כ אנשי צוות דרושים: ${trip.capacity}\n\nצוות ששובץ ומאושר:\n`;
    
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

  const handleExport = () => {
    const currentMonthTrips = trips.filter(trip => {
      const d = new Date(trip.start_date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    if (currentMonthTrips.length === 0) {
      alert('אין טיולים בחודש זה לייצוא.');
      return;
    }

    const headers = ['תאריך', 'לקוח', 'מיקום', 'שעת התחלה', 'שעת סיום', 'סטטוס חיוב', 'עובדים ששובצו'];
    
    const rows = currentMonthTrips.map(trip => {
      const d = new Date(trip.start_date);
      const start = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
      const end = trip.end_date ? new Date(trip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}) : '';
      const clientName = trip.client?.name === 'לקוח כללי' ? 'לקוח כללי (מיומן גוגל)' : (trip.client?.name || '');
      const billed = trip.is_billed ? 'חויב' : 'לא חויב';
      
      const assignments = (trip.assignments || [])
        .filter((a: any) => a.is_confirmed && a.status === 'assigned')
        .map((a: any) => `${a.user?.full_name} (${a.role || 'כללי'})`)
        .join(', ');

      return [
        d.toLocaleDateString('he-IL'),
        clientName,
        trip.location || '',
        start,
        end,
        billed,
        assignments || 'ללא עובדים'
      ];
    });

    exportToCSV(`יומן_טיולים_${month + 1}_${year}`, headers, rows);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" dir="rtl">
      {/* Calendar Header */}
      <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b border-gray-100 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-blue-600 shrink-0" />
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">
              {currentDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors bg-gray-50 border border-gray-200 shadow-sm">
              <ChevronRight size={18} />
            </button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors bg-gray-50 border border-gray-200 shadow-sm">
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex w-full md:w-auto max-w-sm mx-auto md:mx-4 gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="חיפוש חברה או מיקום..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
            />
            <span className="absolute right-2.5 top-2 text-gray-400">🔍</span>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center justify-center shrink-0 w-10 h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition-colors border border-emerald-200"
            title="ייצא טיולים ושיבוצים לאקסל"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 md:gap-4 p-3 bg-gray-50 border-b border-gray-100 text-xs md:text-sm font-semibold justify-center text-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> שובץ במלואו</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> חסרים עובדים</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> חויב (נשלחה חשבונית)</span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-100">
        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(day => (
          <div key={day} className="p-1 md:p-2 text-center text-xs md:text-sm font-bold text-gray-600 border-l last:border-l-0 border-gray-200 truncate">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {blanks.map(b => (
          <div key={`blank-${b}`} className="min-h-[80px] md:min-h-[120px] bg-gray-50/50 border-l border-b border-gray-100"></div>
        ))}

        {days.map(day => {
          const dayTrips = tripsByDate.get(day) || [];
          return (
            <div 
              key={day} 
              className="min-h-[80px] md:min-h-[120px] p-0.5 md:p-1 border-l border-b border-gray-100 relative group hover:bg-blue-50/50 transition-colors cursor-pointer"
              onClick={() => {
                setCreatingTripDate(new Date(year, month, day));
              }}
            >
              <span className={`inline-block font-bold text-[10px] md:text-sm w-5 h-5 md:w-7 md:h-7 text-center leading-5 md:leading-7 rounded-full mb-1 ${
                new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-500'
              }`}>
                {day}
              </span>
              <div className="flex flex-col gap-0.5 md:gap-1">
                {dayTrips.map(trip => {
                    const tripStyle = getTripColor(trip);
                    return (
                  <div 
                    key={trip.id} 
                    className={tripStyle.className}
                    style={tripStyle.style}
                    title={getFullTooltip(trip)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrip(trip);
                    }}
                  >
                    <span className="truncate block md:hidden">{getTripLabelMobile(trip)}</span>
                    <span className="truncate hidden md:block">{getTripLabelDesktop(trip)}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`האם לסמן את הטיול ב-${trip.location} כ${trip.is_billed ? 'לא חויב' : 'חויב (חשבונית הופקה)'}?`)) {
                          toggleBillingMutation.mutate(trip.id);
                        }
                      }}
                      className="mr-1 hover:scale-125 transition-transform hidden md:block"
                      title="סמן הפקת חשבונית"
                    >
                      <CheckCircle2 size={12} className={trip.is_billed ? 'text-red-200' : 'text-white/70'} />
                    </button>
                  </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTrip && (
        <TripDetailsModal 
          selectedTrip={selectedTrip} 
          employees={employees || []} 
          onClose={() => setSelectedTrip(null)} 
        />
      )}

      {creatingTripDate && (
        <CreateManualTripModal 
          initialDate={creatingTripDate} 
          onClose={() => setCreatingTripDate(null)} 
        />
      )}
    </div>
  );
}
