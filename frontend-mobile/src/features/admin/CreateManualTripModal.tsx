import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import SmartClientInput from './SmartClientInput';

const AVAILABLE_ROLES = ["מע\"ר", "חובש", "פראמדיק", "שומר לילה", "מע\"ר חמוש", "חובש חמוש", "מאבטח"];

interface CreateManualTripModalProps {
  initialDate: Date;
  onClose: () => void;
}

export default function CreateManualTripModal({ initialDate, onClose }: CreateManualTripModalProps) {
  const queryClient = useQueryClient();
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);

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
      location: '', 
      start_date: sd, 
      end_date: ed, 
      roles_requirements: {} as Record<string, number>,
      color: '',
      global_salary: '',
      contact_name: '',
      contact_phone: '',
      employee_contact_name: '',
      employee_contact_phone: '',
      notes: ''
    };
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

  const createManualTripMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data };
      if (!payload.global_salary || payload.global_salary === '') payload.global_salary = null;
      if (!payload.end_date || payload.end_date === '') payload.end_date = payload.start_date;
      
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
              placeholder="טקסט קצר שיופיע ליד שם הלקוח"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">מיקום / שם היעד (אופציונלי)</label>
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
          
          {/* תאריכים נוספים לשכפול */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">תאריכים נוספים לאותו אירוע (שכפול לשעות זהות)</label>
            <div className="space-y-2">
              {additionalDates.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input 
                    type="date" 
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    value={d}
                    onChange={e => {
                      const newDates = [...additionalDates];
                      newDates[i] = e.target.value;
                      setAdditionalDates(newDates);
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => setAdditionalDates(additionalDates.filter((_, idx) => idx !== i))}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg font-bold text-sm"
                  >
                    הסר
                  </button>
                </div>
              ))}
              <button 
                type="button"
                onClick={() => setAdditionalDates([...additionalDates, ''])}
                className="text-blue-600 hover:bg-blue-50 font-bold text-sm p-2 rounded-lg w-full text-right"
              >
                + הוסף תאריך נוסף לאירוע
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">שכר בסיס ל-9 שעות (₪)</label>
            <input 
              type="number" 
              min="0"
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
              value={newTripForm.global_salary}
              onChange={e => setNewTripForm({...newTripForm, global_salary: e.target.value})}
              placeholder="הזן סכום גלובלי (אופציונלי)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">שם איש קשר (פנימי)</label>
              <input 
                type="text" 
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                value={newTripForm.contact_name}
                onChange={e => setNewTripForm({...newTripForm, contact_name: e.target.value})}
                placeholder="למשל: דוד"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">נייד איש קשר (פנימי)</label>
              <input 
                type="text" 
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                value={newTripForm.contact_phone}
                onChange={e => setNewTripForm({...newTripForm, contact_phone: e.target.value})}
                placeholder="למשל: 050-1234567"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">שם איש קשר (לעובד)</label>
              <input 
                type="text" 
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                value={newTripForm.employee_contact_name}
                onChange={e => setNewTripForm({...newTripForm, employee_contact_name: e.target.value})}
                placeholder="למשל: נציג שטח"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">נייד איש קשר (לעובד)</label>
              <input 
                type="text" 
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                value={newTripForm.employee_contact_phone}
                onChange={e => setNewTripForm({...newTripForm, employee_contact_phone: e.target.value})}
                placeholder="למשל: 050-1234567"
              />
            </div>
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
            onClick={onClose} 
            className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            ביטול
          </button>
          <button 
            disabled={!newTripForm.client_name || createManualTripMutation.isPending}
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
                contact_name: newTripForm.contact_name || null,
                contact_phone: newTripForm.contact_phone || null,
                employee_contact_name: newTripForm.employee_contact_name || null,
                employee_contact_phone: newTripForm.employee_contact_phone || null,
                notes: newTripForm.notes || null
              });
            }}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            title=""
          >
            {createManualTripMutation.isPending ? 'יוצר...' : 'שמור אירוע'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
