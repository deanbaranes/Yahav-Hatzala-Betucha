import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import SmartClientInput from './SmartClientInput';

const AVAILABLE_ROLES = ["מע\"ר", "חובש", "פראמדיק", "שומר לילה", "מע\"ר חמוש", "חובש חמוש", "מאבטח", "מדריך", "מלווה נשק"];

interface CreateManualTripModalProps {
  initialDate: Date;
  onClose: () => void;
}

export default function CreateManualTripModal({ initialDate, onClose }: CreateManualTripModalProps) {
  const queryClient = useQueryClient();
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  
  const [createTripAssignToAllRecurring, setCreateTripAssignToAllRecurring] = useState(true);

  // assignments array to hold all assignments across all roles
  const [assignments, setAssignments] = useState<any[]>([]);

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/employees');
      return res.data;
    }
  });

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const [newTripForm, setNewTripForm] = useState(() => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = initialDate.getFullYear();
    const month = initialDate.getMonth();
    const day = initialDate.getDate();
    const sd = `${year}-${pad(month+1)}-${pad(day)}T08:00`;
    const ed = `${year}-${pad(month+1)}-${pad(day)}T16:00`;

    return { 
      client_name: '', 
      trip_name: '',
      start_date: sd, 
      end_date: ed, 
      roles_requirements: {} as Record<string, number>,
      contact_name: '',
      contact_phone: '',
      employee_contact_name: '',
      employee_contact_phone: '',
      notes: '',
      has_accommodation: false
    };
  });

  const totalCapacity = Object.values(newTripForm.roles_requirements).reduce((a, b) => a + b, 0);

  const createManualTripMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...newTripForm,
        location: newTripForm.trip_name || 'ללא מיקום',
        trip_name: newTripForm.trip_name || null,
        capacity: totalCapacity,
        has_accommodation: newTripForm.has_accommodation
      };
      
      if (isRecurring) {
        payload.recurring_type = recurringType;
        payload.recurring_end_date = recurringEndDate ? new Date(recurringEndDate).toISOString() : null;
      }

      // Format assigned_users payload
      const validAssignments = assignments.filter(a => a.user_id || a.new_user_name);
      
      payload.assigned_users = validAssignments.map(a => ({
        user_id: a.user_id,
        new_user_name: a.new_user_name,
        role: a.role,
        promised_salary: a.promised_salary ? parseFloat(a.promised_salary) : null,
        send_sms: (a.full_name === 'יהב כלפון' || a.full_name === 'דין ברנס') ? false : a.send_sms
      }));
      
      payload.assign_to_all_recurring = createTripAssignToAllRecurring;
      
      // Post the main trip
      await axiosClient.post('/trips/', payload);
      
      // Post additional dates if any
      if (additionalDates.length > 0) {
        const baseStartTime = payload.start_date.split('T')[1];
        const baseEndTime = payload.end_date.split('T')[1];
        
        for (const d of additionalDates) {
          if (!d) continue;
          const newPayload = { ...payload };
          newPayload.start_date = `${d}T${baseStartTime}`;
          newPayload.end_date = `${d}T${baseEndTime}`;
          await axiosClient.post('/trips/', newPayload);
        }
      }
    },
    onSuccess: () => {
      alert('הטיול נוסף בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      onClose();
    },
    onError: (err: any) => {
      alert('שגיאה בהוספת טיול: ' + (err.response?.data?.detail || ''));
    }
  });

  // Reusable slot component for assignments
  const AssignmentSlot = ({ role, index }: { role: string, index: number }) => {
    // Find the assignment in our array that matches this role and index (by relative index inside that role)
    // To do this reliably, we can just assign an id to it or find by index
    // Let's find the assignment matching this role + index
    const allForRole = assignments.filter(a => a.role === role);
    let assignment = allForRole[index];
    
    // If it doesn't exist, we just render an empty state and we'll create it on change
    if (!assignment) {
      assignment = { full_name: '', user_id: null, new_user_name: '', promised_salary: '', send_sms: true, role: role };
    }

    const [isFocused, setIsFocused] = useState(false);
    const [searchTerm, setSearchTerm] = useState(assignment.full_name || assignment.new_user_name || '');
    
    // Update local searchTerm when assignment changes externally
    useEffect(() => {
        setSearchTerm(assignment.full_name || assignment.new_user_name || '');
    }, [assignment.full_name, assignment.new_user_name]);

    const filtered = employees.filter(e => e.full_name.includes(searchTerm));
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsFocused(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const updateAssignment = (updates: any) => {
      setAssignments(prev => {
        const newArr = [...prev];
        const roleItems = newArr.filter(a => a.role === role);
        const otherRoles = newArr.filter(a => a.role !== role);
        
        while (roleItems.length <= index) {
            roleItems.push({ role, full_name: '', user_id: null, new_user_name: '', promised_salary: '', send_sms: true });
        }
        
        roleItems[index] = { ...roleItems[index], ...updates };
        return [...otherRoles, ...roleItems];
      });
    };

    return (
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2 text-right shadow-sm" ref={containerRef}>
        <div className="font-bold text-blue-800 text-sm mb-2 flex items-center justify-between">
            <span>שיבוץ ל{role} {index + 1 > 1 ? `(${index + 1})` : ''} <span className="text-gray-400 font-normal text-xs">(אופציונלי)</span></span>
        </div>
        
        <div className="relative">
          <input 
            type="text" 
            placeholder="חפש עובד לשיבוץ..." 
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            value={searchTerm}
            onChange={e => {
                setSearchTerm(e.target.value);
                updateAssignment({ new_user_name: e.target.value, full_name: e.target.value, user_id: null });
            }}
            onFocus={() => setIsFocused(true)}
          />
          {isFocused && searchTerm && (
            <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto">
              {filtered.map(emp => (
                <div 
                  key={emp.id} 
                  className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onMouseDown={() => {
                    setSearchTerm(emp.full_name);
                    updateAssignment({ user_id: emp.id, full_name: emp.full_name, new_user_name: '' });
                    setIsFocused(false);
                  }}
                >
                  {emp.full_name}
                </div>
              ))}
              {filtered.length === 0 && (
                <div 
                    className="p-2 text-gray-500 text-sm italic cursor-pointer hover:bg-gray-50"
                    onMouseDown={() => {
                        updateAssignment({ user_id: null, full_name: searchTerm, new_user_name: searchTerm });
                        setIsFocused(false);
                    }}
                >
                    ייוצר עובד זמני בשם: "{searchTerm}"
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-3 flex-wrap sm:flex-nowrap">
            <div className="flex-1">
                <input 
                    type="number" 
                    placeholder="שכר מובטח (₪) למשמרת..." 
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    value={assignment.promised_salary || ''}
                    onChange={e => updateAssignment({ promised_salary: e.target.value })}
                />
            </div>
            <div className="flex items-center">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-gray-700 bg-white border border-gray-300 rounded px-2 py-1">
                    <input 
                        type="checkbox" 
                        checked={assignment.send_sms}
                        onChange={e => updateAssignment({ send_sms: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>שלח SMS?</span>
                </label>
            </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 p-3 sm:p-6 bg-gray-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl max-w-lg w-full mx-auto animate-fade-in text-right my-4 sm:my-10" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
          הוספת טיול חדש: {initialDate.toLocaleDateString('he-IL')}
        </h3>

        <div className="space-y-4">
          <SmartClientInput 
            value={newTripForm.client_name} 
            onChange={(v) => setNewTripForm({...newTripForm, client_name: v})} 
          />

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">הערה / טקסט חופשי (למשל: הדרכה)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
              value={newTripForm.notes}
              onChange={e => setNewTripForm({...newTripForm, notes: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">פרטי הטיול (יוצג לעובדים)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
              value={newTripForm.trip_name}
              onChange={e => setNewTripForm({...newTripForm, trip_name: e.target.value})}
              placeholder="למשל: ביה״ס הריאלי"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">איש קשר פנימי (יוצג למנהלים בלבד)</label>
              <input type="text" className="w-full p-2 border border-gray-300 rounded bg-orange-50 text-sm"
                value={newTripForm.contact_name} onChange={e => setNewTripForm({...newTripForm, contact_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">טלפון פנימי (יוצג למנהלים בלבד)</label>
              <input type="text" className="w-full p-2 border border-gray-300 rounded bg-orange-50 text-sm"
                value={newTripForm.contact_phone} onChange={e => setNewTripForm({...newTripForm, contact_phone: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">איש קשר לטיול (יוצג באפליקציה לעובדים)</label>
              <input type="text" className="w-full p-2 border border-gray-300 rounded bg-blue-50 text-sm"
                value={newTripForm.employee_contact_name} onChange={e => setNewTripForm({...newTripForm, employee_contact_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">טלפון לטיול (יוצג באפליקציה לעובדים)</label>
              <input type="text" className="w-full p-2 border border-gray-300 rounded bg-blue-50 text-sm"
                value={newTripForm.employee_contact_phone} onChange={e => setNewTripForm({...newTripForm, employee_contact_phone: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">שעת התחלה</label>
              <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                value={newTripForm.start_date} onChange={e => setNewTripForm({...newTripForm, start_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">שעת סיום משוערת</label>
              <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                value={newTripForm.end_date} onChange={e => setNewTripForm({...newTripForm, end_date: e.target.value})} />
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 p-3 rounded border">
             <input type="checkbox" id="has_accommodation" className="w-5 h-5"
               checked={newTripForm.has_accommodation}
               onChange={e => setNewTripForm({...newTripForm, has_accommodation: e.target.checked})}
             />
             <label htmlFor="has_accommodation" className="font-bold text-gray-700">כולל לינה?</label>
          </div>

          {/* DYNAMIC TEAM REQUIREMENTS & ASSIGNMENTS */}
          <div className="mb-4 bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-100 p-3 border-b border-gray-200">
                <label className="block text-sm font-bold text-gray-800">דרישות צוות ושיבוצים (סה"כ נדרשים: {totalCapacity})</label>
            </div>
            <div className="p-3">
                <div className="grid grid-cols-2 gap-3 mb-2">
                {AVAILABLE_ROLES.map(role => (
                    <div key={role} className="flex flex-col border border-gray-200 bg-gray-50 p-2 rounded-lg text-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-700">{role}</span>
                            <input type="number" min="0" className="w-16 p-1 border border-gray-300 rounded text-center bg-white"
                                value={newTripForm.roles_requirements[role] || 0}
                                onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setNewTripForm({
                                    ...newTripForm,
                                    roles_requirements: { ...newTripForm.roles_requirements, [role]: val }
                                });
                                // Clean up assignments that exceed the new capacity
                                setAssignments(prev => {
                                    const roleItems = prev.filter(a => a.role === role);
                                    const otherRoles = prev.filter(a => a.role !== role);
                                    if (roleItems.length > val) {
                                        return [...otherRoles, ...roleItems.slice(0, val)];
                                    }
                                    return prev;
                                });
                                }}
                            />
                        </div>
                    </div>
                ))}
                </div>
                
                {/* Render Assignment Slots sequentially for each role with >0 capacity */}
                {AVAILABLE_ROLES.map(role => {
                    const reqCount = newTripForm.roles_requirements[role] || 0;
                    if (reqCount === 0) return null;
                    return Array.from({ length: reqCount }).map((_, index) => (
                        <AssignmentSlot key={`${role}-${index}`} role={role} index={index} />
                    ));
                })}
            </div>
          </div>

          <div className="mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3 border-b pb-2">אירוע מתמשך / סדרת אירועים (אופציונלי)</label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                <span className="font-bold">סדרת מפגשים אוטומטית (שבועי/חודשי)</span>
              </label>
              {isRecurring && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" className="w-4 h-4 rounded"
                        checked={createTripAssignToAllRecurring} onChange={e => setCreateTripAssignToAllRecurring(e.target.checked)} />
                      <span className="font-bold text-blue-800">שבץ את כל העובדים לכל הסדרה במקביל</span>
                  </label>
              )}
            </div>

            {isRecurring && (
              <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-in p-3 bg-white rounded border">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">תדירות</label>
                  <select className="w-full p-2 border border-gray-300 rounded"
                    value={recurringType} onChange={e => setRecurringType(e.target.value)}>
                    <option value="weekly">שבועי (כל שבוע באותו יום)</option>
                    <option value="monthly">חודשי (כל חודש באותו תאריך)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">עד תאריך סיום</label>
                  <input type="date" className="w-full p-2 border border-gray-300 rounded"
                    value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} />
                </div>
              </div>
            )}
            
            <div className="mt-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">או: הוסף תאריכים ספציפיים ידנית</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {additionalDates.map((d, i) => (
                  <div key={i} className="bg-white border rounded-full px-3 py-1 text-sm flex items-center gap-2 shadow-sm">
                    {new Date(d).toLocaleDateString('he-IL')}
                    <button onClick={() => setAdditionalDates(additionalDates.filter((_, idx) => idx !== i))} className="text-red-500 font-bold hover:bg-red-50 rounded-full w-5 h-5 flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="date" className="flex-1 p-2 border border-gray-300 rounded text-sm"
                  id="specific-date-input" />
                <button 
                  onClick={() => {
                    const el = document.getElementById('specific-date-input') as HTMLInputElement;
                    if (el.value && !additionalDates.includes(el.value)) {
                      setAdditionalDates([...additionalDates, el.value]);
                      el.value = '';
                    }
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition-colors text-sm"
                >
                  הוסף תאריך
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 border-t pt-4">
          <button 
            onClick={() => createManualTripMutation.mutate()} 
            disabled={createManualTripMutation.isPending || !newTripForm.client_name}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {createManualTripMutation.isPending ? 'יוצר טיול...' : 'צור טיול ושמור (או פרסם)'}
          </button>
          <button 
            onClick={onClose} 
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-xl transition-colors border border-gray-300"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
