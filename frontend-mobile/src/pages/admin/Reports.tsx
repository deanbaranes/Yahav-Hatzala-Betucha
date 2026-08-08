import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Edit2, Save, X, Trash2, CheckCircle, XCircle, FileText, Plus } from 'lucide-react';
import AdminReportModal from '../../features/admin/AdminReportModal';

export default function Reports() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({ start_time: '', end_time: '', daily_shifts: [], overtime_decimal: 0, expenses: 0, sleeps: 0 });
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

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

  const approveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await axiosClient.patch(`/reports/${reportId}/approve`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
  });

  const rejectMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await axiosClient.patch(`/reports/${reportId}/reject`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
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
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 drop-shadow-sm mb-2">דיווחי עובדים</h1>
          <p className="text-gray-500 font-medium">צפה בדיווחי שעות וקבלות הוצאות של עובדים</p>
        </div>
        <button 
          onClick={() => setIsManualModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-500/20 whitespace-nowrap"
        >
          <Plus size={18} /> דיווח ידני
        </button>
      </header>

      <AdminReportModal 
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-800">דוחות שהוגשו</h2>
          <input 
            type="text"
            placeholder="חיפוש לפי עובד או מיקום..."
            className="p-2 border border-gray-300 rounded-lg w-full sm:w-64 text-sm"
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
                  <th className="hidden md:table-cell p-4 font-bold text-sm">פרטי טיול</th>
                  <th className="p-4 font-bold text-sm">שעות דיווח</th>
                  <th className="hidden lg:table-cell p-4 font-bold text-sm">שעות נוספות</th>
                  <th className="p-4 font-bold text-sm">הוצאות (₪)</th>
                  <th className="hidden md:table-cell p-4 font-bold text-sm">קבלה</th>
                  <th className="p-4 font-bold text-sm">סטטוס</th>
                  <th className="p-4 font-bold text-sm text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports?.map((report) => (
                  <tr key={report.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors">
                    <td className="p-2 md:p-4 break-words">
                      <div className="font-bold text-gray-800">{report?.employee?.full_name || 'עובד לא ידוע'}</div>
                      <div className="text-[10px] md:text-sm text-gray-500">{report?.employee?.phone || ''}</div>
                      <span className="inline-block mt-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                        {report?.employee?.role === 'general' || !report?.employee?.role ? 'כללי' : report.employee.role}
                      </span>
                      {/* Mobile extra info */}
                      <div className="md:hidden mt-2 text-[10px] text-blue-600 font-bold border-t pt-1">
                        {report?.trip?.client_name || 'לקוח'} • {report?.trip?.start_date ? new Date(report.trip.start_date).toLocaleDateString('he-IL') : ''}
                      </div>
                    </td>
                    <td className="hidden md:table-cell p-4">
                      <div className="font-semibold text-blue-700">{report?.trip?.client_name || 'לקוח כללי'}</div>
                      <div className="text-sm text-gray-600">{report?.trip?.location || 'ללא מיקום'}</div>
                      <div className="text-xs text-gray-400">{report?.trip?.start_date ? new Date(report.trip.start_date).toLocaleDateString('he-IL') : ''}</div>
                    </td>
                    <td className="p-2 md:p-4 break-words">
                      {editingReport?.id === report.id ? (
                        <div className="space-y-2">
                          {editForm.daily_shifts && editForm.daily_shifts.length > 0 ? (
                            editForm.daily_shifts.map((shift: any, idx: number) => (
                              <div key={idx} className="border-b border-indigo-100 pb-2 mb-2 last:border-0">
                                <label className="text-[10px] text-indigo-500 font-bold block">יום {idx + 1}</label>
                                <div className="flex flex-col gap-2">
                                  <div>
                                    <label className="text-[9px] text-gray-400 block mb-0.5">התחלה:</label>
                                    <input type="datetime-local" value={shift.start_time} onChange={e => {
                                      const newShifts = [...editForm.daily_shifts];
                                      newShifts[idx].start_time = e.target.value;
                                      setEditForm({...editForm, daily_shifts: newShifts});
                                    }} className="w-[140px] text-[10px] p-1 border rounded bg-gray-50 focus:bg-white" />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-gray-400 block mb-0.5">סיום:</label>
                                    <input type="datetime-local" value={shift.end_time} onChange={e => {
                                      const newShifts = [...editForm.daily_shifts];
                                      newShifts[idx].end_time = e.target.value;
                                      setEditForm({...editForm, daily_shifts: newShifts});
                                    }} className="w-[140px] text-[10px] p-1 border rounded bg-gray-50 focus:bg-white" />
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="flex flex-col gap-2">
                                <div>
                                  <label className="text-[9px] text-gray-500 font-bold block mb-0.5">התחלה:</label>
                                  <input type="datetime-local" value={editForm.start_time} onChange={e => setEditForm({...editForm, start_time: e.target.value})} className="w-[140px] text-[10px] p-1 border rounded bg-gray-50" />
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 font-bold block mb-0.5">סיום:</label>
                                  <input type="datetime-local" value={editForm.end_time} onChange={e => setEditForm({...editForm, end_time: e.target.value})} className="w-[140px] text-[10px] p-1 border rounded bg-gray-50" />
                                </div>
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
                    <td className="hidden lg:table-cell p-4 text-center">
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
                        <input type="number" step="1" value={editForm.expenses} onChange={e => setEditForm({...editForm, expenses: Number(e.target.value)})} className="w-16 p-1 border rounded text-center text-xs" />
                      ) : (
                        <span className="font-bold text-gray-700">₪{report.expenses}</span>
                      )}
                    </td>
                    <td className="hidden md:table-cell p-4">
                      {report.receipt_url ? (
                        <a href={report.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg text-sm font-semibold">
                          <FileText size={14} /> צפה
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">אין קבלה</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {report.manager_status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">ממתין</span>}
                      {report.manager_status === 'approved' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">אושר</span>}
                      {report.manager_status === 'rejected' && <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold">נדחה</span>}
                    </td>
                    <td className="p-4 text-center">
                      {editingReport?.id === report.id ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-center gap-2">
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
                              }} className="bg-green-600 text-white p-2 rounded hover:bg-green-700 transition-colors" title="שמור שינויים">
                                <Save size={18} />
                              </button>
                              <button onClick={() => setEditingReport(null)} className="bg-gray-200 text-gray-600 p-2 rounded hover:bg-gray-300 transition-colors" title="ביטול">
                                <X size={18} />
                              </button>
                            </div>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-2 flex-wrap">
                          {report.manager_status === 'pending' && (
                            <>
                              <button 
                                onClick={() => {
                                  if (window.confirm('האם אתה בטוח שברצונך לאשר דיווח זה? הנתונים יועברו ישירות לחישוב השכר.')) {
                                    approveMutation.mutate(report.id);
                                  }
                                }} 
                                className="text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                              >
                                <CheckCircle size={14} /> אשר 
                              </button>
                            </>
                          )}
                          <button onClick={() => handleEdit(report)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors" title="ערוך דוח">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => {
                            if (window.confirm('האם אתה בטוח שברצונך למחוק דוח זה? לא ניתן לשחזר פעולה זו.')) {
                              deleteMutation.mutate(report.id);
                            }
                          }} className="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors" title="מחק דוח">
                            <Trash2 size={16} />
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
