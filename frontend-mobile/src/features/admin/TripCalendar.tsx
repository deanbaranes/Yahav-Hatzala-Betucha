import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, CheckCircle2, Download } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import SmartClientInput from './SmartClientInput';
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

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      await axiosClient.delete(`/trips/${tripId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      setSelectedTrip(null);
    }
  });

  const toggleBillingMutation = useMutation({
    mutationFn: async (tripId: string) => {
      await axiosClient.put(`/trips/${tripId}/mark-billed`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      setSelectedTrip(null);
    }
  });

  const submitReportMutation = useMutation({
    mutationFn: async (data: any) => {
      await axiosClient.post('/reports/admin-manual', data);
    },
    onSuccess: () => {
      alert('הדיווח נוסף בהצלחה!');
      setReportingAssignment(null);
      setReportDaysCount(1);
      setReportDailyShifts([{ start_time: '', end_time: '' }]);
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err: any) => {
      alert('שגיאה: ' + (err.response?.data?.detail || 'לא ניתן להוסיף דיווח.'));
    }
  });

  const getTripColor = (trip: any): { className: string; style?: React.CSSProperties } => {
    // If trip has a custom color, use it directly
    const baseClasses = "text-[9px] md:text-xs px-0.5 py-0.5 md:px-1.5 md:py-1 rounded-sm shadow-sm font-semibold cursor-pointer transition-all flex justify-between items-center leading-tight overflow-hidden";
    if (trip.color) {
      return { className: `text-white ${baseClasses}`, style: { backgroundColor: trip.color, borderColor: trip.color } };
    }
    if (trip.is_billed) return { className: `bg-red-500 text-white hover:bg-red-600 border border-red-600 ${baseClasses}` };
    const confirmedCount = trip.assignments?.filter((a: any) => a.is_confirmed && a.status === 'assigned').length || 0;
    const isFullyStaffed = trip.capacity > 0 && confirmedCount >= trip.capacity;
    if (isFullyStaffed) return { className: `bg-blue-500 text-white hover:bg-blue-600 border border-blue-600 ${baseClasses}` };
    return { className: `bg-green-500 text-white hover:bg-green-600 border border-green-600 ${baseClasses}` };
  };

  const getTripLabelMobile = (trip: any) => {
    return trip.client?.name === 'לקוח כללי' ? trip.location : (trip.client?.name || trip.location);
  };

  const getTripLabelDesktop = (trip: any) => {
    const confirmedCount = trip.assignments?.filter((a: any) => a.is_confirmed && a.status === 'assigned').length || 0;
    const missing = trip.capacity - confirmedCount;
    const name = trip.client?.name === 'לקוח כללי' ? trip.location : (trip.client?.name || trip.location);
    
    if (trip.is_billed) return `${name} (חויב)`;
    if (missing <= 0) return `${name} (מלא)`;
    return `${name} (חסרים ${missing})`;
  };

  // Generate blank cells for padding
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  // Generate days
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [reportingAssignment, setReportingAssignment] = useState<any>(null);
  const [reportDaysCount, setReportDaysCount] = useState(1);
  const [reportDailyShifts, setReportDailyShifts] = useState([{ start_time: '', end_time: '' }]);

  const [quickEditMode, setQuickEditMode] = useState(false);
  const [quickEditForm, setQuickEditForm] = useState({ client_name: '', location: '', start_date: '', end_date: '', capacity: 0, roles_requirements: {}, color: '', global_salary: '' as string | number, contact_phone: '' });

  // Add Employee Assignment State
  const [assignEmployeeName, setAssignEmployeeName] = useState('');
  const [assignEmployeeRole, setAssignEmployeeRole] = useState('כללי');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);

  // Create Manual Trip State
  const [creatingTripDate, setCreatingTripDate] = useState<Date | null>(null);
  const [newTripForm, setNewTripForm] = useState({ 
    client_name: '', 
    location: '', 
    start_date: '', 
    end_date: '', 
    roles_requirements: {} as Record<string, number>,
    color: '',
    global_salary: '',
    contact_phone: ''
  });

  const updateNewTripRoleCount = (role: string, count: number) => {
    setNewTripForm(prev => {
      const newRoles = { ...prev.roles_requirements };
      if (count <= 0) {
        delete newRoles[role];
      } else {
        newRoles[role] = count;
      }
      return { ...prev, roles_requirements: newRoles };
    });
  };

  const newTripTotalCapacity = Object.values(newTripForm.roles_requirements).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (assignEmployeeName && employees) {
      setFilteredEmployees(employees.filter(e => e.full_name.includes(assignEmployeeName)));
    } else {
      setFilteredEmployees([]);
    }
  }, [assignEmployeeName, employees]);


  const assignEmployeeMutation = useMutation({
    mutationFn: async (payload: { trip_id: string, user_id?: string, new_user_name?: string, role: string }) => {
      // 1. If user_id is missing but new_user_name is provided, we need an endpoint to assign by name or create user.
      // Since our assign logic might not support creating user on the fly, we will do it here.
      let finalUserId = payload.user_id;
      if (!finalUserId && payload.new_user_name) {
         // Create the new employee
         const res = await axiosClient.post('/payroll/employees', {
           full_name: payload.new_user_name,
           phone: `050${Math.floor(1000000 + Math.random() * 9000000)}`, // dummy
           password: '123',
           notes: 'יש לעדכן לעובד שכר שעתי'
         });
         finalUserId = res.data.id;
         alert(`שים לב: הלקוח/עובד ${payload.new_user_name} לא היה קיים, לכן נוצר עובד חדש. יש לעדכן לו שכר שעתי!`);
      }

      await axiosClient.post(`/trips/${payload.trip_id}/assign`, {
        user_id: finalUserId,
        role: payload.role,
        status: 'assigned',
        is_confirmed: true
      });
    },
    onSuccess: () => {
      alert('עובד שובץ בהצלחה!');
      setAssignEmployeeName('');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      // update selected trip state manually or close
      setSelectedTrip(null);
    },
    onError: (err: any) => {
      alert('שגיאה בשיבוץ העובד: ' + (err.response?.data?.detail || ''));
    }
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (payload: { trip_id: string, user_id: string }) => {
      await axiosClient.delete(`/trips/${payload.trip_id}/assign/${payload.user_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      setSelectedTrip(null);
    },
    onError: (err: any) => {
      alert('שגיאה בהסרת עובד: ' + (err.response?.data?.detail || ''));
    }
  });

  const createManualTripMutation = useMutation({
    mutationFn: async (data: any) => {
      await axiosClient.post('/trips/', data);
    },
    onSuccess: () => {
      alert('הטיול נוסף בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      setCreatingTripDate(null);
    },
    onError: (err: any) => {
      alert('שגיאה בהוספת טיול: ' + (err.response?.data?.detail || ''));
    }
  });

  const updateTripMutation = useMutation({
    mutationFn: async (data: any) => {
      await axiosClient.put(`/trips/${selectedTrip.id}`, data);
    },
    onSuccess: () => {
      alert('הטיול עודכן בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      setQuickEditMode(false);
      setSelectedTrip(null);
    },
    onError: (err: any) => {
      alert('שגיאה בעדכון הטיול: ' + (err.response?.data?.detail || 'בדוק את הנתונים ונסה שוב.'));
    }
  });

  const getFullTooltip = (trip: any) => {
    const start = new Date(trip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    const end = trip.end_date ? new Date(trip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}) : 'לא צוין';
    
    let tooltip = `לקוח: ${trip.client?.name === 'לקוח כללי' ? 'מיובא מיומן גוגל' : (trip.client?.name || 'לא ידוע')}\nמיקום/שם הטיול: ${trip.location}\nשעות: ${start} - ${end}\nסה"כ אנשי צוות דרושים: ${trip.capacity}\n\nצוות ששובץ ומאושר:\n`;
    
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
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-blue-600 shrink-0" />
          <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">
            {currentDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
          </h2>
          <button 
            onClick={handleExport}
            className="mr-3 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-xs md:text-sm transition-colors border border-emerald-200 whitespace-nowrap shrink-0"
            title="ייצא טיולים ושיבוצים לאקסל"
          >
            <Download size={14} />
            <span className="hidden sm:inline">ייצוא יומן לאקסל</span>
            <span className="sm:hidden">ייצוא</span>
          </button>
        </div>
        
        <div className="flex-1 w-full max-w-sm mx-auto md:mx-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="חיפוש חברה או מיקום..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
            />
            <span className="absolute right-2.5 top-2 text-gray-400">🔍</span>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-between md:justify-end">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors bg-gray-50 border border-gray-200">
            <ChevronRight size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors bg-gray-50 border border-gray-200">
            <ChevronLeft size={20} />
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
                const pad = (n: number) => n.toString().padStart(2, '0');
                const sd = `${year}-${pad(month+1)}-${pad(day)}T08:00`;
                const ed = `${year}-${pad(month+1)}-${pad(day)}T16:00`;
                setCreatingTripDate(new Date(year, month, day));
                setNewTripForm({ client_name: '', location: '', start_date: sd, end_date: ed, roles_requirements: {}, color: '', global_salary: '', contact_phone: '' });
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
        <div className="fixed inset-0 z-50 p-3 sm:p-6 bg-gray-900/60 backdrop-blur-sm overflow-y-auto" onClick={() => setSelectedTrip(null)}>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl max-w-md w-full mx-auto animate-fade-in text-right my-4 sm:my-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-800">{selectedTrip.client?.name === 'לקוח כללי' ? selectedTrip.location : (selectedTrip.client?.name || 'לקוח לא ידוע')}</h3>
              <div className="flex items-center gap-2">
                {!quickEditMode && (
                  <>
                    <button 
                      onClick={() => {
                        if (confirm(`האם לסמן את הטיול ב-${selectedTrip.location} כ${selectedTrip.is_billed ? 'לא חויב' : 'חויב (חשבונית הופקה)'}?`)) {
                          toggleBillingMutation.mutate(selectedTrip.id);
                        }
                      }}
                      className={`px-2 py-1 rounded text-xs font-bold transition-colors ${selectedTrip.is_billed ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      title="סמן הפקת חשבונית"
                    >
                      {selectedTrip.is_billed ? 'בטל חיוב' : '✔️ חשבונית'}
                    </button>
                    <button onClick={() => {
                      setQuickEditForm({
                        client_name: selectedTrip.client?.name || '',
                        location: selectedTrip.location || '',
                        start_date: selectedTrip.start_date.substring(0, 16),
                        end_date: selectedTrip.end_date ? selectedTrip.end_date.substring(0, 16) : '',
                        capacity: selectedTrip.capacity || 0,
                        roles_requirements: selectedTrip.roles_requirements || {},
                        color: selectedTrip.color || '',
                        global_salary: selectedTrip.global_salary || '',
                        contact_phone: selectedTrip.contact_phone || ''
                      });
                      setQuickEditMode(true);
                      setReportingAssignment(null);
                    }} className="text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded text-xs font-bold transition-colors">
                      ✏️ עריכה
                    </button>
                  </>
                )}
                <button onClick={() => { setSelectedTrip(null); setReportingAssignment(null); setQuickEditMode(false); }} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
              </div>
            </div>
            
            {quickEditMode ? (
              <div className="space-y-4 mb-6 p-4 bg-blue-50/30 rounded-lg border border-blue-100">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">מיקום</label>
                  <input type="text" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.location} onChange={e => setQuickEditForm({...quickEditForm, location: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">שעת התחלה</label>
                  <input type="datetime-local" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.start_date} onChange={e => setQuickEditForm({...quickEditForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">שעת סיום</label>
                  <input type="datetime-local" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.end_date} onChange={e => setQuickEditForm({...quickEditForm, end_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">איש קשר לטיול (טלפון)</label>
                  <input type="text" placeholder="050-1234567" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.contact_phone} onChange={e => setQuickEditForm({...quickEditForm, contact_phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">סה״כ עובדים דרושים</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full p-2 text-sm border border-gray-300 rounded" 
                    value={quickEditForm.capacity} 
                    onChange={e => setQuickEditForm({...quickEditForm, capacity: parseInt(e.target.value) || 0})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">שכר גלובלי לטיול</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full p-2 text-sm border border-gray-300 rounded" 
                    value={quickEditForm.global_salary} 
                    onChange={e => setQuickEditForm({...quickEditForm, global_salary: e.target.value})} 
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-blue-100">
                  <button onClick={() => setQuickEditMode(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">ביטול</button>
                  <button 
                    disabled={updateTripMutation.isPending}
                    onClick={() => updateTripMutation.mutate(quickEditForm)}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded font-bold"
                  >
                    {updateTripMutation.isPending ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>
                
                {/* Employee Assignment inside Quick Edit */}
                <div className="mt-6 pt-4 border-t border-blue-200">
                  <h4 className="text-sm font-bold text-blue-900 mb-2">➕ הוסף עובד לטיול זה</h4>
                  <div className="relative mb-2">
                    <input 
                      type="text" 
                      placeholder="התחל להקליד שם עובד..."
                      className="w-full p-2 text-sm border border-gray-300 rounded"
                      value={assignEmployeeName}
                      onChange={(e) => {
                        setAssignEmployeeName(e.target.value);
                        setShowEmployeeDropdown(true);
                      }}
                      onFocus={() => setShowEmployeeDropdown(true)}
                    />
                    {showEmployeeDropdown && assignEmployeeName && (
                      <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredEmployees.map(emp => (
                          <div 
                            key={emp.id} 
                            className="p-2 text-sm hover:bg-blue-50 cursor-pointer"
                            onClick={() => {
                              setAssignEmployeeName(emp.full_name);
                              setShowEmployeeDropdown(false);
                            }}
                          >
                            {emp.full_name}
                          </div>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <div className="p-2 text-sm text-gray-500 italic">
                            לא נמצא עובד כזה. לחיצה על "שבץ עובד" תיצור עובד חדש.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <select
                    className="w-full p-2 text-sm border border-gray-300 rounded mb-2 bg-white"
                    value={assignEmployeeRole}
                    onChange={e => setAssignEmployeeRole(e.target.value)}
                  >
                    <option value="כללי">כללי</option>
                    <option value="חובש">חובש</option>
                    <option value="מע״ר">מע״ר</option>
                    <option value="מע״ר חמוש">מע״ר חמוש</option>
                    <option value="פראמדיק">פראמדיק</option>
                    <option value="רופא">רופא</option>
                    <option value="מלווה נשק">מלווה נשק</option>
                    <option value="שומר לילה">שומר לילה</option>
                    <option value="נהג">נהג</option>
                  </select>
                  <button 
                    disabled={!assignEmployeeName || assignEmployeeMutation.isPending}
                    onClick={() => {
                      const existing = employees?.find(e => e.full_name === assignEmployeeName);
                      assignEmployeeMutation.mutate({
                        trip_id: selectedTrip.id,
                        user_id: existing?.id,
                        new_user_name: !existing ? assignEmployeeName : undefined,
                        role: assignEmployeeRole
                      });
                    }}
                    className="mt-2 w-full px-3 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded font-bold disabled:opacity-50"
                  >
                    {assignEmployeeMutation.isPending ? 'משבץ...' : 'שבץ עובד'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                  <div className="text-blue-600">📍</div>
                  <div>
                    <div className="text-xs text-gray-500 font-bold">מיקום / פרטים</div>
                    <div className="text-gray-800 font-medium">{selectedTrip.client?.name === 'לקוח כללי' ? 'מיובא מיומן גוגל' : selectedTrip.location}</div>
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

                {selectedTrip.global_salary && (
                  <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                    <div className="text-green-600">💰</div>
                    <div>
                      <div className="text-xs text-green-700 font-bold">שכר גלובלי לטיול</div>
                      <div className="text-green-800 font-black">₪{selectedTrip.global_salary}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500 font-bold mb-2">צוות מאושר בטיול ({selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length || 0} מתוך {selectedTrip.capacity})</div>
                <div className="space-y-2">
                  {selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length === 0 ? (
                    <div className="text-sm text-red-500 font-medium">עדיין לא שובצו עובדים!</div>
                  ) : (
                    selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').map((a:any) => (
                      <div key={a.id} className="flex justify-between items-center text-sm bg-white p-2 border border-gray-100 rounded shadow-sm">
                        <span className="font-bold text-gray-800">{a.user?.full_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium text-xs bg-gray-100 px-2 py-0.5 rounded">{a.role || 'כללי'}</span>
                          <button
                            onClick={() => {
                              setReportingAssignment(a);
                              setReportDaysCount(1);
                              setReportDailyShifts([{
                                start_time: selectedTrip.start_date.substring(0, 16),
                                end_time: selectedTrip.end_date ? selectedTrip.end_date.substring(0, 16) : ''
                              }]);
                            }}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-xs font-bold transition-colors"
                          >
                            דו״ח
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`האם אתה בטוח שברצונך למחוק את ${a.user?.full_name} מהטיול?`)) {
                                removeAssignmentMutation.mutate({ trip_id: selectedTrip.id, user_id: a.user_id });
                              }
                            }}
                            className="text-red-400 hover:text-red-600 p-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                            title="הסר עובד מהטיול"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            {reportingAssignment && (
              <div className="mt-4 p-4 border border-blue-200 bg-blue-50/50 rounded-lg">
                <h4 className="font-bold text-blue-800 mb-3">
                  הוספת דיווח שעות ידני: {reportingAssignment.user?.full_name}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">מספר ימי עבודה (לטיול ארוך)</label>
                    <select 
                      className="w-full p-2 text-sm border border-gray-300 rounded font-bold"
                      value={reportDaysCount}
                      onChange={e => {
                        const count = parseInt(e.target.value) || 1;
                        setReportDaysCount(count);
                        const newShifts = [...reportDailyShifts];
                        if (count > newShifts.length) {
                          for (let i = newShifts.length; i < count; i++) {
                            newShifts.push({ start_time: '', end_time: '' });
                          }
                        } else {
                          newShifts.splice(count);
                        }
                        setReportDailyShifts(newShifts);
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(num => (
                        <option key={num} value={num}>{num} ימים</option>
                      ))}
                    </select>
                  </div>

                  {reportDailyShifts.map((shift, idx) => (
                    <div key={idx} className="bg-white p-2 border border-blue-100 rounded shadow-sm">
                      <h5 className="text-[10px] font-bold text-blue-800 mb-1">יום עבודה {idx + 1}</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 mb-1">התחלה</label>
                          <input 
                            type="datetime-local" 
                            className="w-full p-1 text-xs border border-gray-300 rounded"
                            value={shift.start_time}
                            onChange={e => {
                              const newS = [...reportDailyShifts];
                              newS[idx].start_time = e.target.value;
                              setReportDailyShifts(newS);
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 mb-1">סיום</label>
                          <input 
                            type="datetime-local" 
                            className="w-full p-1 text-xs border border-gray-300 rounded"
                            value={shift.end_time}
                            onChange={e => {
                              const newS = [...reportDailyShifts];
                              newS[idx].end_time = e.target.value;
                              setReportDailyShifts(newS);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-blue-100">
                    <button 
                      onClick={() => setReportingAssignment(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
                    >
                      ביטול
                    </button>
                    <button 
                      disabled={reportDailyShifts.some(s => !s.start_time || !s.end_time) || submitReportMutation.isPending}
                      onClick={() => submitReportMutation.mutate({
                        assignment_id: reportingAssignment.id,
                        daily_shifts: reportDailyShifts.map(s => ({
                          start_time: new Date(s.start_time).toISOString(),
                          end_time: new Date(s.end_time).toISOString()
                        })),
                        expenses: 0
                      })}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded font-bold disabled:opacity-50"
                    >
                      {submitReportMutation.isPending ? 'שומר...' : 'שמור דיווח'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 mt-4 border-t border-gray-100">
              <button 
                onClick={() => {
                  if (window.confirm('האם אתה בטוח שברצונך למחוק טיול זה לצמיתות?')) {
                    deleteTripMutation.mutate(selectedTrip.id);
                  }
                }} 
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-colors flex items-center gap-2"
                disabled={deleteTripMutation.isPending}
              >
                {deleteTripMutation.isPending ? 'מוחק...' : 'מחק טיול'}
              </button>
              <button onClick={() => { setSelectedTrip(null); setReportingAssignment(null); setQuickEditMode(false); }} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors">
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {creatingTripDate && (
        <div className="fixed inset-0 z-50 p-3 sm:p-6 bg-gray-900/60 backdrop-blur-sm overflow-y-auto" onClick={() => setCreatingTripDate(null)}>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl max-w-lg w-full mx-auto animate-fade-in text-right my-4 sm:my-10" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
              הוספת טיול חדש: {creatingTripDate.toLocaleDateString('he-IL')}
            </h3>

            <div className="space-y-4">
              <SmartClientInput 
                value={newTripForm.client_name} 
                onChange={(v) => setNewTripForm({...newTripForm, client_name: v})} 
              />

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">מיקום / שם היעד</label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                  value={newTripForm.location}
                  onChange={e => setNewTripForm({...newTripForm, location: e.target.value})}
                  placeholder="כתובת יעד או תיאור הטיול"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">שעת התחלה</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    value={newTripForm.start_date}
                    onChange={e => setNewTripForm({...newTripForm, start_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">שעת סיום משוערת</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    value={newTripForm.end_date}
                    onChange={e => setNewTripForm({...newTripForm, end_date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">שכר גלובלי לטיול (₪)</label>
                <input 
                  type="number" 
                  min="0"
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                  value={newTripForm.global_salary}
                  onChange={e => setNewTripForm({...newTripForm, global_salary: e.target.value})}
                  placeholder="הזן סכום גלובלי (אופציונלי)"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">טלפון איש קשר (לא יוצג לצוות טרם אישור)</label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                  value={newTripForm.contact_phone}
                  onChange={e => setNewTripForm({...newTripForm, contact_phone: e.target.value})}
                  placeholder="לדוגמה: 050-1234567"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">צבע הטיול ביומן</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {[
                    { color: '', label: 'אוטומטי (לפי סטטוס)' },
                    { color: '#039BE5', label: 'ציאן' },
                    { color: '#D50000', label: 'אדום' },
                    { color: '#0B8043', label: 'ירוק' },
                    { color: '#F4511E', label: 'כתום' },
                    { color: '#8E24AA', label: 'סגול' },
                    { color: '#F6BF26', label: 'צהוב' },
                    { color: '#3F51B5', label: 'כחול' },
                    { color: '#616161', label: 'אפור' },
                  ].map(({ color, label }) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      onClick={() => setNewTripForm({ ...newTripForm, color })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        newTripForm.color === color
                          ? 'border-gray-900 scale-125'
                          : 'border-gray-200 hover:scale-110'
                      }`}
                      style={{ backgroundColor: color || '#e5e7eb' }}
                    >
                      {color === '' && <span className="text-gray-400 text-xs font-bold flex items-center justify-center w-full h-full">א</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 border-b pb-1">
                  דרישות צוות (סה"כ: {newTripTotalCapacity})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {AVAILABLE_ROLES.map(role => (
                    <div key={role} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                      <span className="font-semibold text-gray-700 truncate">{role}</span>
                      <input 
                        type="number" 
                        min="0" 
                        className="w-12 p-1 border border-gray-300 rounded text-center text-xs" 
                        value={newTripForm.roles_requirements[role] || ''} 
                        placeholder="0"
                        onChange={e => updateNewTripRoleCount(role, parseInt(e.target.value) || 0)} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-gray-100">
              <button 
                onClick={() => setCreatingTripDate(null)} 
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                ביטול
              </button>
              <button 
                disabled={!newTripForm.client_name || !newTripForm.location || newTripTotalCapacity === 0 || createManualTripMutation.isPending}
                onClick={() => {
                  createManualTripMutation.mutate({
                    client_name: newTripForm.client_name,
                    location: newTripForm.location,
                    start_date: newTripForm.start_date,
                    end_date: newTripForm.end_date || null,
                    capacity: newTripTotalCapacity,
                    roles_requirements: newTripForm.roles_requirements,
                    color: newTripForm.color,
                    global_salary: newTripForm.global_salary ? parseFloat(newTripForm.global_salary as string) : null,
                    contact_phone: newTripForm.contact_phone || null
                  });
                }}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                title={newTripTotalCapacity === 0 ? "חובה להגדיר לפחות תפקיד אחד לטיול" : ""}
              >
                {createManualTripMutation.isPending ? 'יוצר...' : 'שמור אירוע'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
