import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Edit2, Save, X } from 'lucide-react';

export default function Reports() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editForm, setEditForm] = useState({ start_time: '', end_time: '', overtime_decimal: 0, expenses: 0 });

  const { data: reports, isLoading } = useQuery<any[]>({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/');
      return res.data;
    }
  });

  const filteredReports = reports?.filter((report: any) => 
    report.employee.full_name.includes(searchTerm) || 
    report.trip.location.includes(searchTerm) ||
    (report.trip.client_name && report.trip.client_name.includes(searchTerm))
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

  const handleEdit = (report: any) => {
    // Format to datetime-local strings
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    
    setEditForm({
      start_time: fmt(report.start_time),
      end_time: fmt(report.end_time),
      overtime_decimal: report.overtime_decimal,
      expenses: report.expenses
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
                      <div className="font-bold text-gray-800">{report.employee.full_name}</div>
                      <div className="text-sm text-gray-500">{report.employee.phone}</div>
                      <span className="inline-block mt-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                        {report.employee.role === 'general' || !report.employee.role ? 'כללי' : report.employee.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-blue-700">{report.trip.client_name || 'לקוח כללי'}</div>
                      <div className="text-sm text-gray-600">{report.trip.location}</div>
                      <div className="text-xs text-gray-400">{new Date(report.trip.start_date).toLocaleDateString('he-IL')}</div>
                    </td>
                    <td className="p-4">
                      {editingReport?.id === report.id ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] text-gray-500 font-bold block">התחלה</label>
                            <input type="datetime-local" value={editForm.start_time} onChange={e => setEditForm({...editForm, start_time: e.target.value})} className="w-full text-xs p-1 border rounded" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 font-bold block">סיום</label>
                            <input type="datetime-local" value={editForm.end_time} onChange={e => setEditForm({...editForm, end_time: e.target.value})} className="w-full text-xs p-1 border rounded" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm">
                            <span className="font-semibold">התחלה:</span> {new Date(report.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          <div className="text-sm">
                            <span className="font-semibold">סיום:</span> {new Date(report.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                          </div>
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
                        <input type="number" step="1" value={editForm.expenses} onChange={e => setEditForm({...editForm, expenses: Number(e.target.value)})} className="w-16 p-1 border rounded text-center font-bold" />
                      ) : (
                        <span className="font-bold text-gray-700">₪{report.expenses}</span>
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
                          <button onClick={() => updateMutation.mutate({
                            start_time: new Date(editForm.start_time).toISOString(),
                            end_time: new Date(editForm.end_time).toISOString(),
                            overtime_decimal: editForm.overtime_decimal,
                            expenses: editForm.expenses
                          })} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700 flex items-center justify-center gap-1 text-xs font-bold">
                            <Save size={14} /> שמור
                          </button>
                          <button onClick={() => setEditingReport(null)} className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300 flex items-center justify-center gap-1 text-xs font-bold">
                            <X size={14} /> ביטול
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleEdit(report)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors">
                          <Edit2 size={18} />
                        </button>
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
