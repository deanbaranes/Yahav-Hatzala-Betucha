import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Edit2, Save, X, Trash2 } from 'lucide-react';

export default function Reports() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({ start_time: '', end_time: '', daily_shifts: [], overtime_decimal: 0, expenses: 0, sleeps: 0 });

  const { data: reports, isLoading } = useQuery<any[]>({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/');
      return res.data;
    }
  });

  const filteredReports = reports?.filter((report: any) => 
    report?.employee?.full_name?.includes(searchTerm) || 
    report?.trip?.location?.includes(searchTerm) ||
    (report?.trip?.client_name && report.trip.client_name.includes(searchTerm))
  );

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await axiosClient.put(`/reports/${editingReport.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      setEditingReport(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await axiosClient.delete(`/reports/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    }
  });

  const handleEdit = (report: any) => {
    // Format to datetime-local strings
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (dateStr: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z');
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    
    setEditForm({
      start_time: fmt(report.start_time),
      end_time: fmt(report.end_time),
      daily_shifts: report.daily_shifts ? report.daily_shifts.map((s: any) => ({
        start_time: fmt(s.start_time),
        end_time: fmt(s.end_time)
      })) : [],
      overtime_decimal: report.overtime_decimal,
      expenses: report.expenses,
      sleeps: report.sleeps || 0
    });
    setEditingReport(report);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10" dir="rtl">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 drop-shadow-sm mb-2">ניהול דוחות ושכר</h1>
        <p className="text-gray-500 font-medium">צפה בדיווחי שעות וקבלות הוצאות של עובדים</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">דוחות שהוגשו</h2>
          <input 
            type="text"
            placeholder="חיפוש לפי עובד או מיקום..."
            className="p-2 border border-gray-300 rounded-lg w-64 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-500">טוען דוחות...</div>
        ) : filteredReports?.length === 0 ? (
          <div className="text-center py-10 text-gray-500">לא נמצאו דוחות במערכת.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <th className="p-4 font-bold text-sm">עובד ופרטי קשר</th>
                  <th className="p-4 font-bold text-sm">פרטי טיול</th>
                  <th className="p-4 font-bold text-sm">שעות דיווח</th>
                  <th className="p-4 font-bold text-sm">שעות נוספות (מומר)</th>
                  <th className="p-4 font-bold text-sm">הוצאות (₪)</th>
                  <th className="p-4 font-bold text-sm">קבלה</th>
                  <th className="p-4 font-bold text-sm">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports?.map((report) => (
                  <tr key={report.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{report?.employee?.full_name || 'עובד לא ידוע'}</div>
                      <div className="text-sm text-gray-500">{report?.employee?.phone || ''}</div>
                      <span className="inline-block mt-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                        {report?.employee?.role === 'general' || !report?.employee?.role ? 'כללי' : report.employee.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-blue-700">{report?.trip?.client_name || 'לקוח כללי'}</div>
                      <div className="text-sm text-gray-600">{report?.trip?.location || 'ללא מיקום'}</div>
                      <div className="text-xs text-gray-400">{report?.trip?.start_date ? new Date(report.trip.start_date).toLocaleDateString('he-IL') : ''}</div>
                    </td>
                    <td className="p-4">
                      {editingReport?.id === report.id ? (
                        <div className="space-y-2">
                          {editForm.daily_shifts && editForm.daily_shifts.length > 0 ? (
                            editForm.daily_shifts.map((shift: any, idx: number) => (
                              <div key={idx} className="border-b border-indigo-100 pb-2 mb-2 last:border-0">
                                <label className="text-[10px] text-indigo-500 font-bold block">יום {idx + 1}</label>
                                <div className="flex gap-1">
                                  <input type="datetime-local" value={shift.start_time} onChange={e => {
                                    const newShifts = [...editForm.daily_shifts];
                                    newShifts[idx].start_time = e.target.value;
                                    setEditForm({...editForm, daily_shifts: newShifts});
                                  }} className="w-1/2 text-[10px] p-1 border rounded" />
                                  <input type="datetime-local" value={shift.end_time} onChange={e => {
                                    const newShifts = [...editForm.daily_shifts];
                                    newShifts[idx].end_time = e.target.value;
                                    setEditForm({...editForm, daily_shifts: newShifts});
                                  }} className="w-1/2 text-[10px] p-1 border rounded" />
                                </div>
                              </div>
                            ))
                          ) : (
                            <>
                              <div>
                                <label className="text-[10px] text-gray-500 font-bold block">התחלה</label>
                                <input type="datetime-local" value={editForm.start_time} onChange={e => setEditForm({...editForm, start_time: e.target.value})} className="w-full text-xs p-1 border rounded" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 font-bold block">סיום</label>
                                <input type="datetime-local" value={editForm.end_time} onChange={e => setEditForm({...editForm, end_time: e.target.value})} className="w-full text-xs p-1 border rounded" />
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          {report.daily_shifts && report.daily_shifts.length > 0 ? (
                            <div className="space-y-1">
                              {report.daily_shifts.map((shift: any, idx: number) => (
                                <div key={idx} className="text-[11px] bg-indigo-50/50 p-1 rounded border border-indigo-100 text-indigo-900 shadow-sm flex flex-col">
                                  <span className="font-bold border-b border-indigo-100 mb-0.5">יום {idx + 1} ({new Date(shift.start_time).toLocaleDateString('he-IL')})</span>
                                  <span>{new Date(shift.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})} - {new Date(shift.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div className="text-sm">
                                <span className="font-semibold">התחלה:</span> {new Date(report.start_time).toLocaleDateString('he-IL')} {new Date(report.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                              </div>
                              <div className="text-sm">
                                <span className="font-semibold">סיום:</span> {new Date(report.end_time).toLocaleDateString('he-IL')} {new Date(report.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {editingReport?.id === report.id ? (
                        <input type="number" step="0.5" value={editForm.overtime_decimal} onChange={e => setEditForm({...editForm, overtime_decimal: Number(e.target.value)})} className="w-16 p-1 border rounded text-center font-bold" />
                      ) : (
                        <span className={`font-black text-lg ${report.overtime_decimal > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {report.overtime_decimal > 0 ? `+${report.overtime_decimal}` : '0'}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {editingReport?.id === report.id ? (
                        <div className="flex flex-col gap-1 items-center">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-gray-500">₪</span>
                            <input type="number" step="1" value={editForm.expenses} onChange={e => setEditForm({...editForm, expenses: Number(e.target.value)})} className="w-16 p-1 border rounded text-center text-xs" title="הוצאות" />
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <input type="number" step="1" value={editForm.sleeps} onChange={e => setEditForm({...editForm, sleeps: Number(e.target.value)})} className="w-12 p-1 border rounded text-center text-xs" title="לינות" />
                            <span className="text-[10px] text-gray-500 font-bold">לינות</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-gray-700 text-lg">₪{report.expenses}</span>
                          {report.expenses_notes && (
                            <span className="text-[10px] text-gray-500 max-w-[120px] leading-tight truncate text-center" title={report.expenses_notes}>
                              {report.expenses_notes}
                            </span>
                          )}
                          {report.sleeps > 0 && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mt-1 inline-block w-fit font-bold">
                              {report.sleeps} לינות
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {report.receipt_url ? (
                        <a 
                          href={report.receipt_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 px-3 py-1 rounded-lg text-sm font-semibold transition-colors"
                        >
                          צפה בקבלה 📎
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">אין קבלה</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {editingReport?.id === report.id ? (
                        <div className="flex flex-col gap-2">
                          <button onClick={() => {
                            if (editForm.daily_shifts && editForm.daily_shifts.length > 0) {
                              for (let i = 0; i < editForm.daily_shifts.length; i++) {
                                const start = new Date(editForm.daily_shifts[i].start_time);
                                const end = new Date(editForm.daily_shifts[i].end_time);
                                if (end <= start) {
                                  alert(`שגיאה ביום ${i + 1}: שעת הסיום חייבת להיות אחרי שעת ההתחלה.`);
                                  return;
                                }
                                if (i > 0) {
                                  const prevEnd = new Date(editForm.daily_shifts[i-1].end_time);
                                  if (start < prevEnd) {
                                    alert(`שגיאה בין יום ${i} ליום ${i + 1}: לא ניתן להתחיל יום עבודה לפני שהסתיים היום הקודם.`);
                                    return;
                                  }
                                }
                              }
                            } else {
                              const start = new Date(editForm.start_time);
                              const end = new Date(editForm.end_time);
                              if (end <= start) {
                                alert("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");
                                return;
                              }
                            }

                            updateMutation.mutate({
                              start_time: new Date(editForm.start_time).toISOString(),
                              end_time: new Date(editForm.end_time).toISOString(),
                              daily_shifts: editForm.daily_shifts?.length > 0 ? editForm.daily_shifts.map((s: any) => ({
                                start_time: new Date(s.start_time).toISOString(),
                                end_time: new Date(s.end_time).toISOString()
                              })) : null,
                              overtime_decimal: editForm.overtime_decimal,
                              expenses: editForm.expenses,
                              sleeps: editForm.sleeps
                            });
                          }} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700 flex items-center justify-center gap-1 text-xs font-bold">
                            <Save size={14} /> שמור
                          </button>
                          <button onClick={() => setEditingReport(null)} className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300 flex items-center justify-center gap-1 text-xs font-bold">
                            <X size={14} /> ביטול
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-3">
                          <button onClick={() => handleEdit(report)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors" title="ערוך דוח">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => {
                            if (window.confirm('האם אתה בטוח שברצונך למחוק דוח זה? לא ניתן לשחזר פעולה זו.')) {
                              deleteMutation.mutate(report.id);
                            }
                          }} className="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors" title="מחק דוח">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
