import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Edit2, Save, X, Trash2, CheckCircle, XCircle, FileText, Plus } from 'lucide-react';
import AdminReportModal from '../../features/admin/AdminReportModal';

interface DailyShift {
  start_time: string;
  end_time: string;
}

interface ReportEmployee {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  employment_type?: string;
}

interface ReportTrip {
  id: string;
  location: string;
  start_date: string;
  client_name?: string;
}

export interface TripReport {
  id: string;
  start_time: string;
  end_time: string;
  daily_shifts?: DailyShift[];
  overtime_decimal: number;
  expenses: number;
  expenses_notes?: string;
  sleeps: number;
  receipt_url?: string;
  manager_status: string;
  created_at: string;
  employee: ReportEmployee;
  trip: ReportTrip;
}

interface ReportUpdateData {
  start_time: string;
  end_time: string;
  daily_shifts: DailyShift[];
  overtime_decimal: number;
  expenses: number;
  sleeps: number;
}

export default function Reports() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingReport, setEditingReport] = useState<TripReport | null>(null);
  const [editForm, setEditForm] = useState<ReportUpdateData>({ start_time: '', end_time: '', daily_shifts: [], overtime_decimal: 0, expenses: 0, sleeps: 0 });
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const { data: reports, isLoading } = useQuery<TripReport[]>({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/');
      return res.data;
    }
  });

  const filteredReports = reports?.filter((report: TripReport) => 
    report.employee?.full_name?.includes(searchTerm) || 
    report.trip?.location?.includes(searchTerm) ||
    (report.trip?.client_name && report.trip.client_name.includes(searchTerm))
  );

  const updateMutation = useMutation({
    mutationFn: async (data: ReportUpdateData) => {
      if (!editingReport) return;
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
      queryClient.invalidateQueries({ queryKey: ['pending-reports'] });
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

  const handleDownloadReceipt = (url: string) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert("שגיאה בפתיחת הקבלה.");
    }
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
                  <th className="p-2 md:p-3 font-bold text-[11px] md:text-sm">עובד ופרטי קשר</th>
                  <th className="hidden md:table-cell p-2 md:p-3 font-bold text-[11px] md:text-sm">פרטי טיול</th>
                  <th className="p-2 md:p-3 font-bold text-[11px] md:text-sm">שעות דיווח</th>
                  <th className="hidden lg:table-cell p-2 md:p-3 font-bold text-[11px] md:text-sm">שעות נוספות</th>
                  <th className="p-2 md:p-3 font-bold text-[11px] md:text-sm">הוצאות (₪)</th>
                  <th className="hidden md:table-cell p-2 md:p-3 font-bold text-[11px] md:text-sm">קבלה</th>
                  <th className="p-2 md:p-3 font-bold text-[11px] md:text-sm">סטטוס</th>
                  <th className="p-2 md:p-3 font-bold text-[11px] md:text-sm text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports?.map((report) => (
                  <tr key={report.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors">
                    <td className="p-2 md:p-3 break-words align-top">
                      <div className="font-bold text-gray-800 text-sm">{report?.employee?.full_name || 'עובד לא ידוע'}</div>
                      <div className="text-[10px] md:text-xs text-gray-500">{report?.employee?.phone || ''}</div>
                      <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                        סוג עובד: {report?.employee?.employment_type || 'שכיר'}
                      </div>
                      <span className="inline-block mt-0.5 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                        {report?.employee?.role === 'general' || !report?.employee?.role ? 'כללי' : report.employee.role}
                      </span>
                      {/* Mobile extra info */}
                      <div className="md:hidden mt-1.5 text-[10px] text-blue-600 font-bold border-t pt-1 leading-tight">
                        {report?.trip?.client_name || 'לקוח'} • {report?.trip?.start_date ? new Date(report.trip.start_date).toLocaleDateString('he-IL') : ''}
                      </div>
                    </td>
                    <td className="hidden md:table-cell p-2 md:p-3 align-top">
                      <div className="font-bold text-blue-700 text-xs md:text-sm leading-tight max-w-[120px] lg:max-w-xs">{report?.trip?.client_name || 'לקוח כללי'}</div>
                      <div className="text-[10px] md:text-xs text-gray-600 mt-0.5">{report?.trip?.location || 'ללא מיקום'}</div>
                      <div className="text-[9px] md:text-[10px] text-gray-400">{report?.trip?.start_date ? new Date(report.trip.start_date).toLocaleDateString('he-IL') : ''}</div>
                    </td>
                    <td className="p-2 md:p-3 break-words align-top">
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
                                <div key={idx} className="text-[10px] bg-indigo-50/50 p-1 rounded border border-indigo-100 text-indigo-900 shadow-sm flex flex-col mb-1">
                                  <span className="font-bold border-b border-indigo-100 mb-0.5 leading-none pb-0.5">יום {idx + 1} ({new Date(shift.start_time).toLocaleDateString('he-IL')})</span>
                                  <span className="leading-none pt-0.5">{new Date(shift.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})} - {new Date(shift.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}</span>
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
                    <td className="hidden lg:table-cell p-2 md:p-3 text-center align-top">
                      {editingReport?.id === report.id ? (
                        <input type="number" step="0.5" value={editForm.overtime_decimal} onChange={e => setEditForm({...editForm, overtime_decimal: Number(e.target.value)})} className="w-12 p-0.5 border rounded text-center font-bold text-sm" />
                      ) : (
                        <span className={`font-black text-sm md:text-base ${report.overtime_decimal > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {report.overtime_decimal > 0 ? `+${report.overtime_decimal}` : '0'}
                        </span>
                      )}
                    </td>
                    <td className="p-2 md:p-3 align-top">
                      {editingReport?.id === report.id ? (
                        <input type="number" step="1" value={editForm.expenses} onChange={e => setEditForm({...editForm, expenses: Number(e.target.value)})} className="w-12 p-0.5 border rounded text-center text-xs" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="font-bold text-gray-700 text-xs md:text-sm">₪{report.expenses}</span>
                          <div className="md:hidden">
                            {report.receipt_url ? (
                              <button onClick={() => handleDownloadReceipt(report.receipt_url!)} className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                <FileText size={10} /> קבלה
                              </button>
                            ) : (
                              <span className="text-gray-400 text-[9px]">אין קבלה</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell p-2 md:p-3 align-top">
                      {report.receipt_url ? (
                        <button onClick={() => handleDownloadReceipt(report.receipt_url!)} className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                          <FileText size={12} /> צפה
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[10px]">אין קבלה</span>
                      )}
                    </td>
                    <td className="p-2 md:p-3 text-center align-top">
                      {report.manager_status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-bold">ממתין</span>}
                      {report.manager_status === 'approved' && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold">אושר</span>}
                      {report.manager_status === 'rejected' && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[10px] font-bold">נדחה</span>}
                    </td>
                    <td className="p-2 md:p-3 text-center align-top">
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
                                  })) : [],
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
                        <div className="flex items-center justify-center gap-2 flex-nowrap">
                          {report.manager_status === 'pending' && (
                            <button 
                              onClick={() => {
                                if (window.confirm('האם אתה בטוח שברצונך לאשר דיווח זה? הנתונים יועברו ישירות לחישוב השכר.')) {
                                  approveMutation.mutate(report.id);
                                }
                              }} 
                              className="text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-colors text-sm font-bold flex items-center gap-1 shrink-0 whitespace-nowrap"
                            >
                              <CheckCircle size={16} /> אשר
                            </button>
                          )}
                          <button onClick={() => handleEdit(report)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors shrink-0" title="ערוך דוח">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => {
                            if (window.confirm('האם אתה בטוח שברצונך למחוק דוח זה? לא ניתן לשחזר פעולה זו.')) {
                              deleteMutation.mutate(report.id);
                            }
                          }} className="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors shrink-0" title="מחק דוח">
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
