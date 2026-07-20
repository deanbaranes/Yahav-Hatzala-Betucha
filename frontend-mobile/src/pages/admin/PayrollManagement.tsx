import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Calculator, Save, Download, Copy, Check, Plus, Trash2 } from 'lucide-react';

export default function PayrollManagement() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [copied, setCopied] = useState(false);

  // Edit rates state
  const [editingRates, setEditingRates] = useState(false);
  const [ratesForm, setRatesForm] = useState({ hourly_rate: 0, base_daily_hours: 8.6 });

  // Add adjustment state
  const [adjForm, setAdjForm] = useState({ type: 'מענק התמדה', amount: '', notes: '' });

  const { data: employees, isLoading } = useQuery<any[]>({
    queryKey: ['payroll-employees', selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await axiosClient.get(`/payroll/employees?month=${selectedMonth}&year=${selectedYear}`);
      return res.data;
    }
  });

  const { data: pendingEmployees } = useQuery<any[]>({
    queryKey: ['payroll-pending'],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/employees/pending');
      return res.data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.patch(`/payroll/employees/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-pending'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
      alert('העובד אושר בהצלחה!');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/payroll/employees/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-pending'] });
      alert('העובד נמחק מהמערכת.');
    }
  });

  const { data: adjustments } = useQuery<any[]>({
    queryKey: ['payroll-adjustments', selectedUser?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await axiosClient.get(`/payroll/adjustments/${selectedUser.id}/${selectedMonth}/${selectedYear}`);
      return res.data;
    },
    enabled: !!selectedUser
  });

  const { data: reportData, isFetching: reportFetching, refetch: refetchReport } = useQuery<any>({
    queryKey: ['payroll-export', selectedUser?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await axiosClient.get(`/payroll/export/${selectedUser.id}/${selectedMonth}/${selectedYear}`);
      return res.data;
    },
    enabled: !!selectedUser
  });

  const updateRatesMutation = useMutation({
    mutationFn: async (data: any) => {
      await axiosClient.put(`/payroll/employees/${selectedUser.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
      setEditingRates(false);
      refetchReport();
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/payroll/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
      setSelectedUser(null);
      alert('העובד הוסר בהצלחה מהמערכת.');
    }
  });

  const addAdjustmentMutation = useMutation({
    mutationFn: async (data: any) => {
      await axiosClient.post('/payroll/adjustments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-adjustments'] });
      refetchReport();
      setAdjForm({ type: 'מענק התמדה', amount: '', notes: '' });
    }
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/payroll/adjustments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-adjustments'] });
      refetchReport();
    }
  });

  const handleCopy = () => {
    if (reportData?.report) {
      navigator.clipboard.writeText(reportData.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <div className="p-8 text-center">טוען...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10" dir="rtl">
      <header className="mb-6 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="bg-green-100 text-green-700 p-2 rounded-lg">
              <Calculator size={28} />
            </span>
            ניהול שכר והנהלת חשבונות
          </h1>
          <p className="text-gray-500 text-base mt-2 font-medium">חישוב שכר ממוכן, שעות נוספות ותוספות שכר לעובדים.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Employee List & Month selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {pendingEmployees && pendingEmployees.length > 0 && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="text-yellow-800 font-bold mb-3 flex items-center gap-2">
                עובדים ממתינים לאישור ({pendingEmployees.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pendingEmployees.map(emp => (
                  <div key={emp.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-yellow-100 shadow-sm">
                    <div>
                      <div className="font-bold text-sm">{emp.full_name}</div>
                      <div className="text-xs text-gray-500">{emp.phone}</div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if(confirm(`האם לדחות ולמחוק את בקשת ההרשמה של ${emp.full_name}?`)) {
                            rejectMutation.mutate(emp.id);
                          }
                        }}
                        disabled={rejectMutation.isPending}
                        title="דחה ומחק משתמש"
                        className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button 
                        onClick={() => approveMutation.mutate(emp.id)}
                        disabled={approveMutation.isPending}
                        title="אשר עובד"
                        className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-xl font-bold mb-4">בחר עובד ותקופה</h2>
          
          <div className="flex gap-2 mb-6">
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 font-bold"
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 font-bold"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {employees?.map(emp => (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedUser(emp);
                  setEditingRates(false);
                }}
                className={`w-full text-right p-3 rounded-xl transition-all font-bold ${selectedUser?.id === emp.id ? 'bg-green-500 text-white shadow-md' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                {emp.full_name}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: User Details & Report */}
        {selectedUser ? (
          <div className="lg:col-span-2 space-y-6">
            
            {/* Rates & Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-gray-800">{selectedUser.full_name}</h3>
                {!editingRates ? (
                  <div className="mt-2 text-gray-600 font-medium">
                    <p>תעריף שעתי: <span className="font-bold">{selectedUser.hourly_rate} ₪</span></p>
                    <p>שעות תקן ביום: <span className="font-bold">{selectedUser.base_daily_hours}</span></p>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500">תעריף לשעה (₪)</label>
                      <input type="number" step="0.1" value={ratesForm.hourly_rate} onChange={e => setRatesForm({...ratesForm, hourly_rate: Number(e.target.value)})} className="p-2 border rounded-lg w-24" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500">שעות תקן ליום</label>
                      <input type="number" step="0.1" value={ratesForm.base_daily_hours} onChange={e => setRatesForm({...ratesForm, base_daily_hours: Number(e.target.value)})} className="p-2 border rounded-lg w-24" />
                    </div>
                  </div>
                )}
              </div>
              <div>
                {!editingRates ? (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => {
                      setRatesForm({hourly_rate: selectedUser.hourly_rate, base_daily_hours: selectedUser.base_daily_hours});
                      setEditingRates(true);
                    }} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg font-bold transition-colors text-sm w-full">ערוך תעריף</button>
                    
                    <button 
                      onClick={() => {
                        if (confirm(`האם אתה בטוח שברצונך למחוק את ${selectedUser.full_name} מהמערכת? פעולה זו אינה הפיכה.`)) {
                          deactivateMutation.mutate(selectedUser.id);
                        }
                      }}
                      className="text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg font-bold transition-colors text-sm w-full flex items-center justify-center gap-1"
                    >
                      <Trash2 size={14} /> הסר עובד
                    </button>
                  </div>
                ) : (
                  <button onClick={() => updateRatesMutation.mutate(ratesForm)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <Save size={16} /> שמור תעריף
                  </button>
                )}
              </div>
            </div>

            {/* Adjustments */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold mb-4">תוספות והורדות - {selectedMonth}/{selectedYear}</h3>
              
              <div className="flex gap-2 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">סוג תוספת</label>
                  <select value={adjForm.type} onChange={e => setAdjForm({...adjForm, type: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg font-bold text-gray-700">
                    <option value="הבראה">הבראה</option>
                    <option value="נסיעות">נסיעות</option>
                    <option value="מענק התמדה">מענק התמדה</option>
                    <option value="לינה">לינה (תעריף לילה: 80₪)</option>
                    <option value="שעות נוספות">השלמת שעות נוספות</option>
                    <option value="אחר">אחר</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    {adjForm.type === 'לינה' ? 'מספר לילות' : adjForm.type === 'שעות נוספות' ? 'כמות שעות' : 'סכום (₪)'}
                  </label>
                  <input type="number" step="0.1" value={adjForm.amount} onChange={e => setAdjForm({...adjForm, amount: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="לדוגמה 2" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">הערות</label>
                  <input type="text" value={adjForm.notes} onChange={e => setAdjForm({...adjForm, notes: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="לא חובה" />
                </div>
                <button 
                  onClick={() => addAdjustmentMutation.mutate({...adjForm, user_id: selectedUser.id, month: selectedMonth, year: selectedYear, amount: Number(adjForm.amount)})}
                  disabled={!adjForm.amount}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 disabled:opacity-50 h-[42px]"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-2">
                {adjustments?.map(adj => (
                  <div key={adj.id} className="flex justify-between items-center p-3 border-b border-gray-100 hover:bg-gray-50">
                    <div>
                      <span className="font-bold text-gray-800">{adj.type}</span>
                      {adj.notes && <span className="text-gray-500 text-sm mr-2">- {adj.notes}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-black ${adj.type === 'לינה' || adj.type === 'שעות נוספות' ? 'text-blue-700' : 'text-green-700'}`}>
                        {adj.amount} {adj.type === 'לינה' ? 'לילות' : adj.type === 'שעות נוספות' ? 'שעות' : '₪'}
                      </span>
                      <button onClick={() => deleteAdjustmentMutation.mutate(adj.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                {adjustments?.length === 0 && <p className="text-gray-400 text-sm">אין תוספות לחודש זה.</p>}
              </div>
            </div>

            {/* Generated Report */}
            <div className="bg-slate-900 rounded-2xl shadow-lg p-6 text-white relative">
              <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Download size={20} className="text-blue-400" />
                  דוח שכר להנהלת חשבונות
                </h3>
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'הועתק!' : 'העתק דוח'}
                </button>
              </div>
              
              {reportFetching ? (
                <div className="animate-pulse flex space-x-4">
                  <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-blue-50" dir="rtl">
                  {reportData?.report || 'לא ניתן לייצר דוח. בדוק הגדרות עובד.'}
                </pre>
              )}
            </div>

          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="text-center text-gray-400">
              <Calculator size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">בחר עובד מהרשימה כדי לצפות בנתוני השכר שלו</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
