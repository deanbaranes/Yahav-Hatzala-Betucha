import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

import AssignEmployeeForm from './AssignEmployeeForm';
import TripTeamList from './TripTeamList';
import TripQuickEditForm from './TripQuickEditForm';
import TripAdminReportingForm from './TripAdminReportingForm';

interface TripDetailsModalProps {
  selectedTrip: any;
  employees: any[];
  onClose: () => void;
  initialEditMode?: boolean;
}

export default function TripDetailsModal({ selectedTrip, employees, onClose, initialEditMode = false }: TripDetailsModalProps) {
  const queryClient = useQueryClient();

  const [reportingAssignment, setReportingAssignment] = useState<any>(null);

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
                        notes: selectedTrip.notes || '',
                        has_accommodation: selectedTrip.has_accommodation ?? true
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
              <TripQuickEditForm 
                quickEditForm={quickEditForm}
                setQuickEditForm={setQuickEditForm}
                setQuickEditMode={setQuickEditMode}
                updateTripMutation={updateTripMutation}
              />
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
                    {selectedTrip.has_accommodation === false && (
                      <div className="text-[10px] text-red-600 font-bold bg-red-50 mt-1 inline-block px-2 py-0.5 rounded-full border border-red-100">
                        🚫 ללא לינה (לא יחושב שכר לילה)
                      </div>
                    )}
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
                  <TripTeamList 
                    trip={selectedTrip}
                    setReportingAssignment={setReportingAssignment}
                    removeAssignmentMutation={removeAssignmentMutation}
                  />

                  {/* Employee Assignment */}
                  {quickEditMode && (
                    <AssignEmployeeForm 
                      tripId={selectedTrip.id} 
                      employees={employees || []} 
                      onAssignSuccess={() => onClose()} 
                    />
                  )}
                </div>

            <TripAdminReportingForm 
              assignment={reportingAssignment}
              tripStartDate={selectedTrip.start_date}
              tripEndDate={selectedTrip.end_date}
              onClose={() => setReportingAssignment(null)}
            />

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
