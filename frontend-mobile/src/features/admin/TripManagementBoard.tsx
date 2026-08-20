import { useState, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import SmartClientInput from './SmartClientInput';
import GoogleCalendarImport from './GoogleCalendarImport';
import { CheckCircle2, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const AVAILABLE_ROLES = ["מע\"ר", "חובש", "פראמדיק", "שומר לילה", "מע\"ר חמוש", "חובש חמוש", "מאבטח", "כללי"];

export default function TripManagementBoard() {
  const queryClient = useQueryClient();
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {} as Record<string, number>, color: '' as string, global_salary: '' as string | number, contact_phone: '' as string });
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [isFormVisible, setIsFormVisible] = useState(false);
  
  const { user } = useAuth();
  // זמנית: הוספנו גם את דין (0504851269) כדי שתוכל לראות את השינויים
  const isYahav = user?.name?.includes('יהב') || (user as any)?.full_name?.includes('יהב') || (user as any)?.phone === '0533210777' || user?.name?.includes('דין') || (user as any)?.full_name?.includes('דין') || (user as any)?.phone === '0504851269';
  
  const [assignEmployeeName, setAssignEmployeeName] = useState('');
  const [assignEmployeeRole, setAssignEmployeeRole] = useState('כללי');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const totalCapacity = Object.values(formData.roles_requirements).reduce((a, b) => a + b, 0);

  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/employees');
      return res.data;
    }
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(e => e.full_name.includes(assignEmployeeName) && e.status === 'active');
  }, [employees, assignEmployeeName]);

  const assignEmployeeMutation = useMutation({
    mutationFn: (data: { trip_id: string; employee_id: string | null; full_name: string; role: string; overwrite: boolean }) => 
      axiosClient.post(`/trips/${data.trip_id}/assign`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      alert('העובד שובץ בהצלחה!');
      setAssignEmployeeName('');
    },
    onError: (error: any) => {
      if (error.response?.status === 400 && error.response.data.detail.includes('already has an active assignment')) {
        if (confirm('לעובד כבר יש שיבוץ פעיל באותו זמן. האם לדרוס את השיבוץ הקיים ולהעביר אותו לטיול זה?')) {
           const existing = employees?.find(e => e.full_name === assignEmployeeName);
           assignEmployeeMutation.mutate({
             trip_id: editingTripId!,
             employee_id: existing ? existing.id : null,
             full_name: assignEmployeeName,
             role: assignEmployeeRole,
             overwrite: true
           });
        }
      } else {
        alert('שגיאה בשיבוץ העובד: ' + (error.response?.data?.detail || ''));
      }
    }
  });

  const createTrip = useMutation({
    mutationFn: (data: any) => {
      const payload = { ...data, capacity: totalCapacity };
      if (!payload.global_salary || payload.global_salary === '') payload.global_salary = null;
      if (!payload.end_date || payload.end_date === '') payload.end_date = payload.start_date;
      return axiosClient.post('/trips/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      alert('הטיול נוצר בהצלחה!');
      setFormData({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {}, color: '', global_salary: '', contact_phone: '' });
      setIsFormVisible(false);
    },
    onError: (error: any) => {
      alert('שגיאה ביצירת הטיול: ' + (error.response?.data?.detail || 'אנא ודא שכל השדות מלאים ותקינים.'));
    }
  });

  const updateTrip = useMutation({
    mutationFn: (data: any) => {
      const payload = { ...data, capacity: totalCapacity };
      if (!payload.global_salary || payload.global_salary === '') payload.global_salary = null;
      if (!payload.end_date || payload.end_date === '') payload.end_date = payload.start_date;
      return axiosClient.put(`/trips/${editingTripId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      alert('הטיול עודכן בהצלחה!');
      setEditingTripId(null);
      setFormData({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {}, color: '', global_salary: '', contact_phone: '' });
    },
    onError: (error: any) => {
      alert('שגיאה בעדכון הטיול: ' + (error.response?.data?.detail || 'אנא ודא שכל השדות מלאים ותקינים.'));
    }
  });

  const { data: trips, isLoading: isLoadingTrips } = useQuery<any[]>({
    queryKey: ['admin-trips'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/');
      return res.data;
    }
  });

  const deleteTrip = useMutation({
    mutationFn: (tripId: string) => axiosClient.delete(`/trips/${tripId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      if (confirm('הטיול נמחק בהצלחה.')) {}
    }
  });

  const updateRoleCount = (role: string, count: number) => {
    setFormData(prev => {
      const newRoles = { ...prev.roles_requirements };
      if (count <= 0) {
        delete newRoles[role];
      } else {
        newRoles[role] = count;
      }
      return { ...prev, roles_requirements: newRoles };
    });
  };

  const groupedTrips = useMemo(() => {
    if (!trips) return [];
    
    const filtered = trips.filter((t: any) => 
      (t.client?.name || '').includes(searchTerm) || (t.location || '').includes(searchTerm)
    );
    
    // Sort ascending by date (oldest first, chronological)
    filtered.sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    const groups: { month: string; weeks: { weekName: string; trips: any[] }[] }[] = [];

    filtered.forEach((trip: any) => {
        const d = new Date(trip.start_date);
        const monthStr = d.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
        
        // Calculate week string (e.g., "1-7 בחודש")
        const weekStart = Math.floor((d.getDate() - 1) / 7) * 7 + 1;
        const weekEnd = Math.min(weekStart + 6, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
        const weekStr = `תאריכים ${weekStart}-${weekEnd} ב${d.toLocaleString('he-IL', { month: 'long' })}`;

        let monthGroup = groups.find(g => g.month === monthStr);
        if (!monthGroup) {
            monthGroup = { month: monthStr, weeks: [] };
            groups.push(monthGroup);
        }

        let weekGroup = monthGroup.weeks.find(w => w.weekName === weekStr);
        if (!weekGroup) {
            weekGroup = { weekName: weekStr, trips: [] };
            monthGroup.weeks.push(weekGroup);
        }

        weekGroup.trips.push(trip);
    });

    return groups;
  }, [trips, searchTerm]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8 text-right" dir="rtl">
      <div className="mb-6 flex justify-start">
        <GoogleCalendarImport />
      </div>

      {isYahav && !editingTripId && !isFormVisible ? (
        <div className="mb-8">
          <button 
            onClick={() => setIsFormVisible(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow transition-colors"
          >
            <Plus size={20} />
            הוסף טיול חדש
          </button>
        </div>
      ) : (
        <div id="edit-form-area">
          <div className="flex flex-col gap-3 mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold text-gray-800">{editingTripId ? 'עריכת טיול' : 'יצירת טיול חדש'}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SmartClientInput value={formData.client_name} onChange={(v) => setFormData({...formData, client_name: v})} />
        
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">מיקום (אופציונלי)</label>
          <input type="text" placeholder="כתובת יעד" className="w-full p-2 border border-gray-300 rounded" 
            value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        </div>
          
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">שעת התחלה</label>
          <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded" 
            value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
        </div>
          
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">שעת סיום משוערת</label>
          <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded" 
            value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">שכר גלובלי לטיול (₪)</label>
          <input type="number" min="0" className="w-full p-2 border border-gray-300 rounded placeholder:text-sm" 
            placeholder="הזן סכום גלובלי (אופציונלי)"
            value={formData.global_salary} onChange={e => setFormData({...formData, global_salary: e.target.value})} />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">פרטי איש קשר (אופציונלי - שם/טלפון, לא יוצג טרם אישור)</label>
          <input type="text" className="w-full p-2 border border-gray-300 rounded placeholder:text-sm" 
            placeholder="לדוגמה: דוד 050-1234567"
            value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} />
        </div>
          
        <div className="mb-4 md:col-span-2">
          <label className="block text-gray-700 font-bold mb-2">צבע הטיול ביומן</label>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { color: '', label: 'אוטומטי (לפי סטטוס)' },
              { color: '#039BE5', label: 'ציאן (Peacock)' },
              { color: '#D50000', label: 'אדום (Tomato)' },
              { color: '#0B8043', label: 'ירוק (Basil)' },
              { color: '#F4511E', label: 'כתום (Tangerine)' },
              { color: '#8E24AA', label: 'סגול (Grape)' },
              { color: '#F6BF26', label: 'צהוב (Banana)' },
              { color: '#3F51B5', label: 'כחול (Blueberry)' },
              { color: '#616161', label: 'אפור (Graphite)' },
            ].map(({ color, label }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={() => setFormData({ ...formData, color })}
                className={`w-8 h-8 rounded-full border-4 transition-all ${
                  formData.color === color
                    ? 'border-gray-800 scale-125'
                    : 'border-gray-200 hover:scale-110'
                }`}
                style={{ backgroundColor: color || '#e5e7eb' }}
              >
                {color === '' && <span className="text-gray-400 text-xs font-bold flex items-center justify-center w-full h-full">א</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 md:col-span-2">
          <label className="block text-gray-700 font-bold mb-4 border-b pb-2">דרישות צוות (סה"כ: {totalCapacity})</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {AVAILABLE_ROLES.map(role => (
              <div key={role} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="font-semibold text-gray-700">{role}</span>
                <input 
                  type="number" 
                  min="0" 
                  className="w-16 p-1 border border-gray-300 rounded text-center" 
                  value={formData.roles_requirements[role] || ''} 
                  placeholder="0"
                  onChange={e => updateRoleCount(role, parseInt(e.target.value) || 0)} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
        
      <div className="flex gap-4 mt-6">
        <button 
          onClick={() => editingTripId ? updateTrip.mutate(formData) : createTrip.mutate(formData)} 
          disabled={createTrip.isPending || updateTrip.isPending || !formData.client_name || !formData.start_date}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow transition-colors disabled:bg-gray-400"
          title=""
        >
          {createTrip.isPending || updateTrip.isPending ? 'שומר...' : editingTripId ? 'שמור שינויים' : 'צור טיול'}
        </button>
        
        {editingTripId ? (
          <button 
            onClick={() => {
              setEditingTripId(null);
              setFormData({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {}, color: '', global_salary: '', contact_phone: '' });
            }}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold shadow transition-colors"
          >
            ביטול עריכה
          </button>
        ) : (
          isYahav && (
            <button 
              onClick={() => setIsFormVisible(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold shadow transition-colors"
            >
              ביטול
            </button>
          )
        )}
      </div>
      </div>
      )}

      {editingTripId && (
        <div className="mt-8 p-6 bg-blue-50/50 rounded-lg border border-blue-100">
          <h4 className="text-lg font-bold text-blue-900 mb-4">➕ הוסף עובד לטיול זה (שיבוץ ידני)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="relative">
              <label className="block text-gray-700 font-bold mb-2">שם העובד</label>
              <input 
                type="text" 
                placeholder="התחל להקליד שם עובד..."
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
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
                      className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
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
                      לא נמצא עובד כזה. לחיצה על "שבץ עובד" תיצור רישום זמני למערכת.
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-2">תפקיד בטיול</label>
              <select
                className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500"
                value={assignEmployeeRole}
                onChange={e => setAssignEmployeeRole(e.target.value)}
              >
                {AVAILABLE_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <button 
                disabled={!assignEmployeeName || assignEmployeeMutation.isPending}
                onClick={() => {
                  const existing = employees?.find(e => e.full_name === assignEmployeeName);
                  assignEmployeeMutation.mutate({
                    trip_id: editingTripId,
                    employee_id: existing ? existing.id : null,
                    full_name: assignEmployeeName,
                    role: assignEmployeeRole,
                    overwrite: false
                  });
                }}
                className="w-full px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold shadow transition-colors disabled:opacity-50"
              >
                {assignEmployeeMutation.isPending ? 'משבץ...' : 'שבץ עובד כעת'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trips List */}
      <div className="mt-12 border-t pt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h3 className="text-xl font-bold text-gray-800">טיולים קיימים במערכת</h3>
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="חיפוש חברה או מיקום..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
            />
            <span className="absolute right-2.5 top-2.5 text-gray-400">🔍</span>
          </div>
        </div>

        {isLoadingTrips ? (
          <div className="text-gray-500">טוען טיולים...</div>
        ) : !trips || trips.length === 0 ? (
          <div className="text-gray-500">אין עדיין טיולים פעילים.</div>
        ) : groupedTrips.length === 0 ? (
          <div className="text-gray-500">לא נמצאו טיולים מתאימים לחיפוש.</div>
        ) : (
          <div className="space-y-10">
            {groupedTrips.map(monthGroup => (
              <div key={monthGroup.month} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-100/50 px-6 py-4 border-b border-gray-100">
                  <h4 className="text-xl font-black text-gray-800">{monthGroup.month}</h4>
                </div>
                
                <div className="p-4 space-y-6">
                  {monthGroup.weeks.map(weekGroup => (
                    <div key={weekGroup.weekName} className="space-y-3">
                      <button 
                        onClick={() => setExpandedWeeks(prev => ({...prev, [weekGroup.weekName]: !prev[weekGroup.weekName]}))}
                        className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        <span className="text-[10px] bg-blue-200 text-blue-800 w-5 h-5 flex items-center justify-center rounded-full">
                          {expandedWeeks[weekGroup.weekName] ? '▼' : '◀'}
                        </span>
                        {weekGroup.weekName}
                      </button>
                      
                      {expandedWeeks[weekGroup.weekName] && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-3">
                          {weekGroup.trips.map(trip => (
                            <div key={trip.id} className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-white shadow-sm hover:shadow transition-shadow">
                              {/* Header: Title and Actions */}
                              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                                <div className="flex items-start gap-3 w-full sm:w-auto">
                                  <div className="flex shrink-0 gap-1 mt-0.5">
                                    <button 
                                      onClick={() => {
                                        setEditingTripId(trip.id);
                                        setFormData({
                                          client_name: trip.client?.name || '',
                                          location: trip.location || '',
                                          start_date: trip.start_date ? trip.start_date.substring(0, 16) : '',
                                          end_date: trip.end_date ? trip.end_date.substring(0, 16) : '',
                                          roles_requirements: trip.roles_requirements || {},
                                          color: trip.color || '',
                                          global_salary: trip.global_salary || '',
                                          contact_phone: trip.contact_phone || ''
                                        });
                                          setTimeout(() => {
                                          document.getElementById('edit-form-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 50);
                                      }}
                                      className="text-gray-400 hover:text-blue-600 p-2 transition-colors bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg"
                                      title="ערוך טיול"
                                    >
                                      ✎
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (window.confirm('האם אתה בטוח שברצונך למחוק טיול זה לצמיתות?')) {
                                          deleteTrip.mutate(trip.id);
                                        }
                                      }}
                                      className="text-red-400 hover:text-red-600 p-2 transition-colors bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg"
                                      title="מחק טיול"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="flex-1 min-w-0 pt-1">
                                    <div className="font-black text-sm sm:text-base text-blue-900 leading-tight mb-1 break-words">
                                      {trip.client?.name === 'לקוח כללי' ? trip.location : trip.client?.name}
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-600 font-medium break-words">
                                      {trip.client?.name === 'לקוח כללי' ? 'מיובא מיומן גוגל' : trip.location}
                                    </div>
                                    {trip.notes && (
                                      <div className="text-[11px] sm:text-xs text-orange-600 font-bold mt-1.5 bg-orange-50 px-2 py-0.5 rounded inline-block">
                                        {trip.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg sm:rounded-full text-[11px] sm:text-xs font-bold flex items-center justify-center sm:inline-block w-full sm:w-auto border border-indigo-200">
                                    דרושים {trip.capacity} אנשי צוות
                                  </span>
                                </div>
                              </div>

                              {/* Dates */}
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-gray-600 bg-gray-50 p-2 sm:p-2.5 rounded-lg border border-gray-100 mb-3">
                                <span className="text-blue-600">📅</span>
                                <span>{new Date(trip.start_date).toLocaleString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>
                                <span className="text-gray-300 mx-1">|</span>
                                <span className="text-blue-600">⏰</span>
                                {trip.end_date ? (
                                  <span>{new Date(trip.start_date).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(trip.end_date).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                ) : (
                                  <span>החל מ- {new Date(trip.start_date).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                              </div>
                              
                              {/* Confirmed Employees */}
                              {trip.assignments?.filter((a:any) => a.is_confirmed).length > 0 && (
                                <div className="border-t border-gray-100 pt-3 mt-3">
                                  <span className="text-[10px] sm:text-xs font-bold text-gray-500 mb-2 block">עובדים ששובצו ואושרו:</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {trip.assignments.filter((a:any) => a.is_confirmed).map((a:any) => (
                                      <span key={a.id} className="bg-white border border-gray-200 text-gray-800 px-2 py-1 rounded text-xs shadow-sm font-semibold flex items-center gap-1">
                                        {a.employee_confirmed_arrival ? (
                                          <span title="אישר הגעה סופית" className="flex items-center"><CheckCircle2 size={14} className="text-green-500" /></span>
                                        ) : (
                                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" title="טרם אישר הגעה סופית"></div>
                                        )}
                                        {a.user?.full_name || 'עובד'} <span className="text-gray-400 font-normal">({a.role === 'general' || !a.role ? 'כללי' : a.role})</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
