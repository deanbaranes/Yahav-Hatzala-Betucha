import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { CheckCircle2 } from 'lucide-react';
import AssignEmployeeForm from './AssignEmployeeForm';

const AVAILABLE_ROLES = ["מע\"ר", "חובש", "פראמדיק", "שומר לילה", "מע\"ר חמוש", "חובש חמוש", "מאבטח", "מדריך"];

interface TripDetailsModalProps {
  selectedTrip: any;
  employees: any[];
  onClose: () => void;
  initialEditMode?: boolean;
}

export default function TripDetailsModal({ selectedTrip, employees, onClose, initialEditMode = false }: TripDetailsModalProps) {
  const queryClient = useQueryClient();

  const [reportingAssignment, setReportingAssignment] = useState<any>(null);
  const [reportDaysCount, setReportDaysCount] = useState(1);
  const [reportDailyShifts, setReportDailyShifts] = useState([{ start_time: '', end_time: '' }]);

  const [quickEditMode, setQuickEditMode] = useState(initialEditMode);
  
  const [isRecurringDuplicate, setIsRecurringDuplicate] = useState(false);
  const [recurringType, setRecurringType] = useState('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [quickEditForm, setQuickEditForm] = useState({ 
    client_name: selectedTrip.client?.name || '', 
    location: selectedTrip.location || '', 
    start_date: selectedTrip.start_date?.substring(0, 16) || '', 
    end_date: selectedTrip.end_date ? selectedTrip.end_date.substring(0, 16) : '', 
    capacity: selectedTrip.capacity || 0, 
    roles_requirements: selectedTrip.roles_requirements || {}, 
    color: selectedTrip.color || '', 
    global_salary: selectedTrip.global_salary || '', 
    contact_name: selectedTrip.contact_name || '', 
    contact_phone: selectedTrip.contact_phone || '', 
    employee_contact_name: selectedTrip.employee_contact_name || '',
    employee_contact_phone: selectedTrip.employee_contact_phone || '',
    notes: selectedTrip.notes || '' 
  });

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      await axiosClient.delete(`/trips/${tripId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      onClose();
    }
  });

  const toggleBillingMutation = useMutation({
    mutationFn: async (tripId: string) => {
      await axiosClient.put(`/trips/${tripId}/mark-billed`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      onClose();
    }
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (payload: { trip_id: string, user_id: string }) => {
      await axiosClient.delete(`/trips/${payload.trip_id}/assign/${payload.user_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      onClose();
    },
    onError: (err: any) => {
      alert('שגיאה בהסרת עובד: ' + (err.response?.data?.detail || ''));
    }
  });

  const updateTripMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data };
      if (!payload.global_salary || payload.global_salary === '') payload.global_salary = null;
      if (!payload.end_date || payload.end_date === '') payload.end_date = payload.start_date;
      await axiosClient.put(`/trips/${selectedTrip.id}`, payload);
    },
    onSuccess: () => {
      alert('הטיול עודכן בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      setQuickEditMode(false);
      onClose();
    },
    onError: (err: any) => {
    onError: (err: any) => {
      alert('שגיאה בעדכון הטיול: ' + (err.response?.data?.detail || 'בדוק את הנתונים ונסה שוב.'));
    }
  });

  const duplicateRecurringMutation = useMutation({
    mutationFn: async (payload: any) => {
      await axiosClient.post(`/trips/${selectedTrip.id}/duplicate-recurring`, payload);
    },
    onSuccess: () => {
      alert('הטיול שוכפל לסדרה בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      setIsRecurringDuplicate(false);
      onClose();
    },
    onError: (err: any) => {
      alert('שגיאה בשכפול הטיול: ' + (err.response?.data?.detail || 'בדוק את הנתונים ונסה שוב.'));
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

  return createPortal(
        <div className="fixed inset-0 z-50 p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl max-w-md w-full mx-auto animate-fade-in text-right my-4 sm:my-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 gap-2">
              <div className="flex flex-col gap-1 w-full max-w-[65%]">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
                  {selectedTrip.client?.name === 'לקוח כללי' ? selectedTrip.location : (selectedTrip.client?.name || 'לקוח לא ידוע')}
                </h3>
                {!quickEditMode && selectedTrip.notes && (
                  <div className="text-sm text-gray-600 font-medium whitespace-pre-wrap">{selectedTrip.notes}</div>
                )}
              </div>
              <div className="flex flex-wrap justify-end items-center gap-1.5 shrink-0">
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
                        contact_name: selectedTrip.contact_name || '',
                        contact_phone: selectedTrip.contact_phone || '',
                        employee_contact_name: selectedTrip.employee_contact_name || '',
                        employee_contact_phone: selectedTrip.employee_contact_phone || '',
                        notes: selectedTrip.notes || ''
                      });
                      setQuickEditMode(true);
                      setReportingAssignment(null);
                    }} className="text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded text-xs font-bold transition-colors">
                      ✏️ עריכה
                    </button>
                    <button 
                      onClick={() => setIsRecurringDuplicate(!isRecurringDuplicate)} 
                      className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded text-xs font-bold transition-colors"
                      title="שכפל לסדרה חוזרת"
                    >
                      🔁 שכפל
                    </button>
                  </>
                )}
                <button onClick={() => { onClose(); }} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
              </div>
            </div>
            
            {isRecurringDuplicate && !quickEditMode && (
              <div className="mb-4 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 animate-fade-in text-right">
                <h4 className="text-sm font-bold text-indigo-900 mb-2">🔁 יצירת אירוע חוזר מטיול זה</h4>
                <p className="text-xs text-indigo-700 mb-3">
                  המערכת תשכפל את הטיול הנוכחי (כולל שעות, מיקום ועובדים ששובצו) לסדרה שבועית/דו-שבועית.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">תדירות</label>
                    <select 
                      className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                      value={recurringType}
                      onChange={(e) => setRecurringType(e.target.value)}
                    >
                      <option value="weekly">כל שבוע</option>
                      <option value="biweekly">כל שבועיים</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">תאריך סיום</label>
                    <input 
                      type="date"
                      className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                      value={recurringEndDate}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    disabled={!recurringEndDate || duplicateRecurringMutation.isPending}
                    onClick={() => duplicateRecurringMutation.mutate({ recurring_type: recurringType, recurring_end_date: `${recurringEndDate}T00:00:00Z` })}
                    className="flex-1 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded font-bold text-sm disabled:opacity-50"
                  >
                    {duplicateRecurringMutation.isPending ? 'משכפל...' : 'שכפל כעת'}
                  </button>
                  <button onClick={() => setIsRecurringDuplicate(false)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded">ביטול</button>
                </div>
              </div>
            )}

            {quickEditMode ? (
              <div className="space-y-4 mb-6 p-4 bg-blue-50/30 rounded-lg border border-blue-100">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">הערה / טקסט חופשי (למשל: הדרכה)</label>
                  <input type="text" placeholder="טקסט שיופיע ליד שם הלקוח" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.notes} onChange={e => setQuickEditForm({...quickEditForm, notes: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">מיקום (אופציונלי)</label>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">שם איש קשר (פנימי)</label>
                    <input type="text" placeholder="למשל: דוד" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.contact_name} onChange={e => setQuickEditForm({...quickEditForm, contact_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">נייד איש קשר (פנימי)</label>
                    <input type="text" placeholder="למשל: 050-1234567" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.contact_phone} onChange={e => setQuickEditForm({...quickEditForm, contact_phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">שם איש קשר (לעובד)</label>
                    <input type="text" placeholder="למשל: נציג שטח" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.employee_contact_name} onChange={e => setQuickEditForm({...quickEditForm, employee_contact_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">נייד איש קשר (לעובד)</label>
                    <input type="text" placeholder="למשל: 050-1234567" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.employee_contact_phone} onChange={e => setQuickEditForm({...quickEditForm, employee_contact_phone: e.target.value})} />
                  </div>
                </div>
                <div className="mb-4 md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-2 border-b pb-1">
                    דרישות צוות (סה"כ: {(Object.values(quickEditForm.roles_requirements || {}) as number[]).reduce((a, b) => a + b, 0)})
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map(role => (
                      <div key={role} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                        <span className="text-xs font-semibold text-gray-700">{role}</span>
                        <input 
                          type="number" 
                          min="0" 
                          className="w-12 p-1 border border-gray-300 rounded text-center text-xs" 
                          value={quickEditForm.roles_requirements?.[role] || ''} 
                          placeholder="0"
                          onChange={e => {
                            const count = parseInt(e.target.value) || 0;
                            const newRoles = { ...(quickEditForm.roles_requirements || {}) };
                            if (count <= 0) {
                              delete newRoles[role];
                            } else {
                              newRoles[role] = count;
                            }
                            const newCapacity = (Object.values(newRoles) as number[]).reduce((a, b) => a + b, 0);
                            setQuickEditForm({...quickEditForm, roles_requirements: newRoles, capacity: newCapacity});
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">שכר בסיס ל-9 שעות</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full p-2 text-sm border border-gray-300 rounded" 
                    value={quickEditForm.global_salary} 
                    onChange={e => setQuickEditForm({...quickEditForm, global_salary: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">צבע הטיול ביומן</label>
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
                        onClick={() => setQuickEditForm({ ...quickEditForm, color })}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          quickEditForm.color === color
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
                  <div className="text-blue-600">📅</div>
                  <div>
                    <div className="text-xs text-gray-500 font-bold">תאריך ושעות</div>
                    <div className="text-gray-800 font-medium">
                      {new Date(selectedTrip.start_date).toLocaleDateString('he-IL')} • {new Date(selectedTrip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})} - {selectedTrip.end_date ? new Date(selectedTrip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}) : 'לא הוגדר'}
                    </div>
                  </div>
                </div>

                {selectedTrip.global_salary && (
                  <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                    <div className="text-green-600">💰</div>
                    <div>
                      <div className="text-xs text-green-700 font-bold">שכר בסיס ל-9 שעות</div>
                      <div className="text-green-800 font-black">₪{selectedTrip.global_salary}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

              <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500 font-bold mb-2">
                    צוות מאושר בטיול ({selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length || 0} מתוך {selectedTrip.capacity})
                    {selectedTrip.roles_requirements && Object.keys(selectedTrip.roles_requirements).length > 0 ? (
                      <span className="block text-xs text-blue-600 mt-1.5 font-medium bg-blue-50 p-1.5 rounded-md border border-blue-100 w-fit">
                        סוגי עובדים נדרשים: {Object.entries(selectedTrip.roles_requirements).map(([role, count]) => `${count} ${role}`).join(', ')}
                      </span>
                    ) : (
                      <span className="block text-xs text-blue-600 mt-1.5 font-medium bg-blue-50 p-1.5 rounded-md border border-blue-100 w-fit">
                        סוגי עובדים נדרשים: {selectedTrip.capacity} כללי
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length === 0 ? (
                      <div className="text-sm text-red-500 font-medium">עדיין לא שובצו עובדים!</div>
                    ) : (
                      selectedTrip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').map((a:any) => (
                        <div key={a.id} className="flex justify-between items-center text-sm bg-white p-2 border border-gray-100 rounded shadow-sm">
                          <span className="font-bold text-gray-800 flex items-center gap-1.5">
                            {a.employee_confirmed_arrival ? (
                              <span title="אישר הגעה סופית" className="flex items-center"><CheckCircle2 size={14} className="text-green-500" /></span>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-gray-300" title="טרם אישר הגעה סופית"></div>
                            )}
                            {a.user?.full_name}
                          </span>
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

                  {/* Employee Assignment moved out of Quick Edit */}
                  <AssignEmployeeForm 
                    tripId={selectedTrip.id} 
                    employees={employees || []} 
                    onAssignSuccess={() => onClose()} 
                  />
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
              <button onClick={() => { onClose(); }} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors">
                סגור
              </button>
            </div>
          </div>
        </div>,
        document.body
  );
}
