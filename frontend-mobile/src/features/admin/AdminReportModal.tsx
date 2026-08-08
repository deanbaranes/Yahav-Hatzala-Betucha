import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { X, Plus } from 'lucide-react';
import ReceiptUploader from '../employee/ReceiptUploader';

interface AdminReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PendingAssignment {
  assignment_id: string;
  trip_id: string;
  employee_name: string;
  location: string;
  start_date: string;
  role: string;
}

interface ManualReportData {
  assignment_id: string;
  expenses: number;
  expenses_notes: string;
  sleeps: number;
  receipt_url: string;
  daily_shifts: { start_time: string; end_time: string }[];
}

export default function AdminReportModal({ isOpen, onClose }: AdminReportModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ expenses: 0, expenses_notes: '', sleeps: 0, receipt_url: '', assignment_id: '' });
  const [daysCount, setDaysCount] = useState(1);
  const [dailyShifts, setDailyShifts] = useState([{ start_time: '', end_time: '' }]);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: pendingAssignments, isLoading } = useQuery<PendingAssignment[]>({
    queryKey: ['all-pending-reports'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/all-pending-reports');
      return res.data;
    },
    enabled: isOpen
  });

  const reportMutation = useMutation({
    mutationFn: (data: ManualReportData) => axiosClient.post('/reports/admin-manual', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['all-pending-reports'] });
      setFormData({ expenses: 0, expenses_notes: '', sleeps: 0, receipt_url: '', assignment_id: '' });
      setDaysCount(1);
      setDailyShifts([{ start_time: '', end_time: '' }]);
      onClose();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setErrorMsg(err.response?.data?.detail || 'שגיאה בשמירת הדיווח.');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl animate-scale-up my-auto">
        <div className="sticky top-0 bg-white/90 backdrop-blur-md p-6 border-b border-gray-100 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-black text-gray-800">דיווח שעות ידני</h2>
            <p className="text-gray-500 text-sm mt-1">הזנת דיווח עבור עובד שטרם דיווח</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2 text-sm">בחר עובד וטיול</label>
            {isLoading ? (
              <div className="text-gray-500">טוען נתונים...</div>
            ) : pendingAssignments?.length === 0 ? (
              <div className="text-red-500 bg-red-50 p-4 rounded-xl border border-red-200 font-bold">
                אין טיולים הממתינים לדיווח במערכת. כולם דווחו!
              </div>
            ) : (
              <select 
                className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500" 
                value={formData.assignment_id} 
                onChange={e => setFormData({...formData, assignment_id: e.target.value})}
              >
                <option value="" disabled>-- לחץ כאן לבחירה --</option>
                {pendingAssignments?.map(a => (
                  <option key={a.assignment_id} value={a.assignment_id}>
                    {a.employee_name} | {a.location} | {new Date(a.start_date).toLocaleDateString('he-IL')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {formData.assignment_id && (
            <div className="animate-fade-in space-y-6">
              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2 text-sm">מספר ימי עבודה</label>
                <select 
                  className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-sm font-bold"
                  value={daysCount}
                  onChange={e => {
                    const count = parseInt(e.target.value) || 1;
                    setDaysCount(count);
                    setFormData(prev => ({...prev, sleeps: Math.max(0, count - 1)}));
                    const newShifts = [...dailyShifts];
                    const firstDayStart = newShifts[0]?.start_time ? new Date(newShifts[0].start_time) : new Date();
                    if (count > newShifts.length) {
                      for (let i = newShifts.length; i < count; i++) {
                        const nextDay = new Date(firstDayStart);
                        nextDay.setDate(nextDay.getDate() + i);
                        nextDay.setHours(8, 0, 0, 0);
                        
                        const nextEnd = new Date(nextDay);
                        nextEnd.setHours(17, 0, 0, 0);

                        const toLocalISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                        
                        newShifts.push({ 
                          start_time: toLocalISO(nextDay), 
                          end_time: toLocalISO(nextEnd)
                        });
                      }
                    } else {
                      newShifts.splice(count);
                    }
                    setDailyShifts(newShifts);
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num} ימים</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 mb-4">
                {dailyShifts.map((shift, idx) => (
                  <div key={idx} className="p-4 border border-blue-100 rounded-xl bg-blue-50/50 shadow-sm">
                    <h3 className="font-bold text-blue-800 mb-3 text-sm">יום {idx + 1}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-600 font-bold mb-1 text-xs">התחלה</label>
                        <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white" 
                          value={shift.start_time} 
                          onChange={e => {
                            const newShifts = [...dailyShifts];
                            newShifts[idx].start_time = e.target.value;
                            setDailyShifts(newShifts);
                          }} />
                      </div>
                      <div>
                        <label className="block text-gray-600 font-bold mb-1 text-xs">סיום</label>
                        <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white" 
                          value={shift.end_time} 
                          onChange={e => {
                            const newShifts = [...dailyShifts];
                            newShifts[idx].end_time = e.target.value;
                            setDailyShifts(newShifts);
                          }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
                
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-bold mb-2 text-sm">מספר לינות (₪80)</label>
                  <input type="number" min="0" className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 font-bold" 
                    value={formData.sleeps} onChange={e => setFormData(prev => ({...prev, sleeps: parseInt(e.target.value) || 0}))} />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-2 text-sm">הוצאות (₪)</label>
                  <input type="number" min="0" className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 font-bold" 
                    value={formData.expenses} onChange={e => setFormData(prev => ({...prev, expenses: parseInt(e.target.value) || 0}))} />
                </div>
              </div>
                
              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2 text-sm">פירוט הוצאות</label>
                <textarea placeholder="לדוגמה: דלק 50" className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white" rows={2}
                  value={formData.expenses_notes} onChange={e => setFormData(prev => ({...prev, expenses_notes: e.target.value}))}></textarea>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2 text-sm">קבלה</label>
                <ReceiptUploader 
                  onUploadComplete={(url) => setFormData(prev => ({...prev, receipt_url: url}))} 
                  onRemove={() => setFormData(prev => ({...prev, receipt_url: ''}))}
                />
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 font-semibold text-center text-sm">
                  {errorMsg}
                </div>
              )}

              <button 
                onClick={() => {
                  for (let i = 0; i < dailyShifts.length; i++) {
                    const start = new Date(dailyShifts[i].start_time);
                    const end = new Date(dailyShifts[i].end_time);
                    if (end <= start) {
                      setErrorMsg(`שגיאה ביום ${i + 1}: שעת הסיום חייבת להיות אחרי שעת ההתחלה.`);
                      return;
                    }
                  }
                  
                  const payload = {
                    assignment_id: formData.assignment_id,
                    expenses: formData.expenses,
                    expenses_notes: formData.expenses_notes,
                    sleeps: formData.sleeps,
                    receipt_url: formData.receipt_url,
                    daily_shifts: dailyShifts.map(s => ({
                      start_time: new Date(s.start_time).toISOString(),
                      end_time: new Date(s.end_time).toISOString()
                    }))
                  };
                  reportMutation.mutate(payload);
                }}
                disabled={reportMutation.isPending || dailyShifts.some(s => !s.start_time || !s.end_time) || !formData.assignment_id}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-lg shadow-md transition-colors disabled:bg-gray-400 mt-4"
              >
                {reportMutation.isPending ? 'שומר...' : 'שמור דיווח'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
