import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ReceiptUploader from './ReceiptUploader';

export default function ReportForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ expenses: 0, expenses_notes: '', sleeps: 0, receipt_url: '', assignment_id: '' });
  const [daysCount, setDaysCount] = useState(1);
  const [dailyShifts, setDailyShifts] = useState<{start_time: string, end_time: string, is_absent?: boolean}[]>([{ start_time: '', end_time: '' }]);
  const [savedDays, setSavedDays] = useState<boolean[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const reportMutation = useMutation({
    mutationFn: (data: any) => axiosClient.post('/reports/', data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['pending-reports'] });
      queryClient.invalidateQueries({ queryKey: ['report-draft', formData.assignment_id] });
      
      if (!variables.is_draft) {
        setSuccessMsg(true);
        setTimeout(() => {
          setSuccessMsg(false);
          setFormData({ expenses: 0, expenses_notes: '', sleeps: 0, receipt_url: '', assignment_id: '' });
          setDaysCount(1);
          setDailyShifts([{ start_time: '', end_time: '' }]);
          navigate('/');
        }, 2000);
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'שגיאה בשליחת הדו"ח. אנא נסה שנית.');
    }
  });

  const handleSaveDraft = (idx: number) => {
    const shift = dailyShifts[idx];
    if (!shift.is_absent) {
      if (!shift.start_time || !shift.end_time) {
        setErrorMsg(`אנא הזן שעת התחלה וסיום עבור יום ${idx + 1} לפני השמירה.`);
        return;
      }
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      if (end <= start) {
        setErrorMsg(`שעת הסיום חייבת להיות אחרי שעת ההתחלה ביום ${idx + 1}.`);
        return;
      }
    }
    
    // Filter only valid shifts for the draft: 
    // Only include shifts that are already saved, OR the current shift being saved.
    const validShifts = dailyShifts.filter((s, i) => (s.start_time && s.end_time) && (savedDays[i] || i === idx));
    
    const payload = {
      assignment_id: formData.assignment_id,
      expenses: formData.expenses,
      expenses_notes: formData.expenses_notes,
      sleeps: formData.sleeps,
      receipt_url: formData.receipt_url,
      is_draft: true,
      daily_shifts: validShifts.map(s => ({
        start_time: new Date(s.start_time).toISOString(),
        end_time: new Date(s.is_absent ? s.start_time : s.end_time).toISOString(),
        is_absent: !!s.is_absent
      }))
    };
    reportMutation.mutate(payload, {
      onSuccess: () => {
        setSavedDays(prev => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });
      }
    });
  };

  const handleSaveGlobalDraft = () => {
    const validShifts = dailyShifts.filter((s) => s.is_absent || (s.start_time && s.end_time));
    if (validShifts.length === 0) {
      setErrorMsg('אין נתונים לשמירה בטיוטה.');
      return;
    }

    const payload = {
      assignment_id: formData.assignment_id,
      expenses: formData.expenses,
      expenses_notes: formData.expenses_notes,
      sleeps: formData.sleeps,
      receipt_url: formData.receipt_url,
      is_draft: true,
      daily_shifts: validShifts.map(s => ({
        start_time: new Date(s.start_time).toISOString(),
        end_time: new Date(s.is_absent ? s.start_time : s.end_time).toISOString(),
        is_absent: !!s.is_absent
      }))
    };
    reportMutation.mutate(payload, {
      onSuccess: () => {
        alert("הטיוטה נשמרה בהצלחה! תוכל להמשיך לדווח במועד מאוחר יותר.");
        setFormData({ expenses: 0, expenses_notes: '', sleeps: 0, receipt_url: '', assignment_id: '' });
        setDaysCount(1);
        setDailyShifts([{ start_time: '', end_time: '' }]);
      }
    });
  };

  const { data: pendingAssignments, isLoading } = useQuery<any[]>({
    queryKey: ['pending-reports'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/my-pending-reports');
      return res.data;
    }
  });

  const { data: draftReport, isLoading: isDraftLoading } = useQuery({
    queryKey: ['report-draft', formData.assignment_id],
    queryFn: async () => {
      const res = await axiosClient.get(`/reports/my-draft/${formData.assignment_id}`);
      return res.data;
    },
    enabled: !!formData.assignment_id
  });

  useEffect(() => {
    let expectedDays = 1;
    const selectedAssignment = pendingAssignments?.find(a => a.assignment_id === formData.assignment_id);
    if (selectedAssignment?.start_date && selectedAssignment?.end_date) {
        const start = new Date(selectedAssignment.start_date);
        const end = new Date(selectedAssignment.end_date);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        expectedDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    } else if (selectedAssignment?.start_date) {
        expectedDays = 1; // Default to 1 if no end_date
    }

    const toLocalISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    if (draftReport) {
      setFormData(prev => ({
        ...prev,
        expenses: draftReport.expenses || 0,
        expenses_notes: draftReport.expenses_notes || '',
        sleeps: draftReport.sleeps || 0,
        receipt_url: draftReport.receipt_url || ''
      }));
      
      const newShifts = [];
      const newSavedDays = [];
      const draftShifts = draftReport.daily_shifts && draftReport.daily_shifts.length > 0 ? draftReport.daily_shifts : (draftReport.start_time ? [draftReport] : []);
      
      const firstDayStart = draftShifts[0]?.start_time ? new Date(draftShifts[0].start_time) : (selectedAssignment ? new Date(selectedAssignment.start_date) : new Date());
      
      for (let i = 0; i < expectedDays; i++) {
        if (i < draftShifts.length) {
            newShifts.push({
              start_time: toLocalISO(new Date(draftShifts[i].start_time)),
              end_time: toLocalISO(new Date(draftShifts[i].end_time)),
              is_absent: !!draftShifts[i].is_absent
            });
            newSavedDays.push(true);
        } else {
            const nextDay = new Date(firstDayStart);
            nextDay.setDate(nextDay.getDate() + i);
            nextDay.setHours(8, 0, 0, 0);
            const nextEnd = new Date(nextDay);
            nextEnd.setHours(17, 0, 0, 0);
            newShifts.push({
                start_time: toLocalISO(nextDay),
                end_time: toLocalISO(nextEnd)
            });
            newSavedDays.push(false);
        }
      }
      setDailyShifts(newShifts);
      setDaysCount(expectedDays);
      setSavedDays(newSavedDays);
      setFormData(prev => ({...prev, sleeps: Math.max(0, expectedDays - 1)}));
    } else if (formData.assignment_id && !isDraftLoading) {
      // Reset if no draft
      setFormData(prev => ({ ...prev, expenses: 0, expenses_notes: '', sleeps: Math.max(0, expectedDays - 1), receipt_url: '' }));
      
      const newShifts = [];
      const firstDayStart = selectedAssignment ? new Date(selectedAssignment.start_date) : new Date();
      for (let i = 0; i < expectedDays; i++) {
            const nextDay = new Date(firstDayStart);
            nextDay.setDate(nextDay.getDate() + i);
            nextDay.setHours(8, 0, 0, 0);
            const nextEnd = new Date(nextDay);
            nextEnd.setHours(17, 0, 0, 0);
            newShifts.push({
                start_time: toLocalISO(nextDay),
                end_time: toLocalISO(nextEnd)
            });
      }
      setDaysCount(expectedDays);
      setDailyShifts(newShifts);
      setSavedDays(new Array(expectedDays).fill(false));
    }
  }, [draftReport, formData.assignment_id, isDraftLoading, pendingAssignments]);

  const currentAssignment = pendingAssignments?.find(a => a.assignment_id === formData.assignment_id);
  const isLastDayReached = currentAssignment ? new Date().setHours(0,0,0,0) >= new Date(currentAssignment.end_date || currentAssignment.start_date).setHours(0,0,0,0) : false;
  const allDaysCompleted = dailyShifts.length > 0 && dailyShifts.length === daysCount && dailyShifts.every(s => s.is_absent || (s.start_time && s.end_time));

  if (successMsg) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center min-h-[50vh] space-y-6">
        <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 className="text-3xl font-black text-gray-800 text-center">הדו״ח נשלח בהצלחה!</h2>
        <p className="text-gray-500 text-center font-medium">הנתונים עודכנו במערכת. מעביר למסך הראשי...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 text-right" dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">דיווח שעות והוצאות</h2>
      
      <div className="mb-6">
        <label className="block text-gray-700 font-bold mb-2 text-lg">בחר טיול לדיווח</label>
        {isLoading ? (
          <div className="text-gray-500">טוען טיולים...</div>
        ) : pendingAssignments?.length === 0 ? (
          <div className="text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200">
            אין טיולים הממתינים לדיווח. (אם סיימת הרגע טיול, ייתכן שתצטרך לרענן את העמוד)
          </div>
        ) : (
          <select 
            className="w-full p-4 border border-blue-300 rounded-xl bg-blue-50/30 text-lg font-bold shadow-sm focus:ring-2 focus:ring-blue-500" 
            value={formData.assignment_id} 
            onChange={e => setFormData({...formData, assignment_id: e.target.value})}
          >
            <option value="" disabled>-- לחץ כאן לבחירת טיול --</option>
            {pendingAssignments?.map(a => (
              <option key={a.assignment_id} value={a.assignment_id}>
                {a.location} | {new Date(a.start_date).toLocaleDateString('he-IL')}{a.end_date && new Date(a.start_date).toDateString() !== new Date(a.end_date).toDateString() ? ` - ${new Date(a.end_date).toLocaleDateString('he-IL')}` : ''} | {a.role === 'general' || !a.role ? 'כללי' : a.role}
              </option>
            ))}
          </select>
        )}
      </div>

      {formData.assignment_id && (
        <div className="animate-fade-in space-y-6">
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2 text-lg">משך הטיול</label>
            <div className="w-full p-4 border border-blue-200 rounded-xl bg-blue-50 text-blue-800 text-lg font-bold shadow-sm flex items-center justify-between">
              <span>{daysCount} ימים</span>
              <span className="text-sm bg-blue-100 px-3 py-1 rounded-full">מחושב אוטומטית לפי יומן הטיולים</span>
            </div>
          </div>

          <div className="space-y-4 mb-4">
            {dailyShifts.map((shift, idx) => (
              <div key={idx} className={`p-4 border rounded-xl shadow-sm relative transition-colors ${shift.is_absent ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50/30'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className={`font-bold text-sm ${shift.is_absent ? 'text-gray-500 line-through' : 'text-blue-800'}`}>יום עבודה {idx + 1}</h3>
                    {!savedDays[idx] && (
                      <button 
                        onClick={() => {
                          const newShifts = [...dailyShifts];
                          newShifts[idx].is_absent = !newShifts[idx].is_absent;
                          setDailyShifts(newShifts);
                          setFormData(prev => ({...prev, sleeps: Math.max(0, newShifts.filter(s => !s.is_absent).length - 1)}));
                        }}
                        className={`text-xs px-2 py-1 rounded-md font-bold transition-colors ${shift.is_absent ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                      >
                        {shift.is_absent ? 'ביטול היעדרות' : '🚫 לא עבדתי ביום זה'}
                      </button>
                    )}
                  </div>
                  {savedDays[idx] ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-green-600 font-bold text-xs">✅ נשמר</span>
                      <button 
                        onClick={() => {
                          const newSaved = [...savedDays];
                          newSaved[idx] = false;
                          setSavedDays(newSaved);
                        }}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-lg text-xs font-bold"
                      >
                        ✏️ עריכה
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleSaveDraft(idx)}
                      disabled={reportMutation.isPending || (!shift.is_absent && (!shift.start_time || !shift.end_time))}
                      className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 px-3 py-1 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                    >
                      💾 שמור יום זה
                    </button>
                  )}
                </div>
                {!shift.is_absent ? (
                  <div className="grid grid-cols-2 gap-4 animate-fade-in">
                    <div>
                      <label className="block text-gray-600 font-bold mb-1 text-sm">התחלה</label>
                      <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200" 
                        disabled={savedDays[idx]}
                        value={shift.start_time} 
                        onChange={e => {
                          const newShifts = [...dailyShifts];
                          newShifts[idx].start_time = e.target.value;
                          setDailyShifts(newShifts);
                        }} />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-bold mb-1 text-sm">סיום</label>
                      <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200" 
                        disabled={savedDays[idx]}
                        value={shift.end_time} 
                        onChange={e => {
                          const newShifts = [...dailyShifts];
                          newShifts[idx].end_time = e.target.value;
                          setDailyShifts(newShifts);
                        }} />
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm font-semibold text-center py-2 animate-fade-in bg-white rounded-lg border border-gray-200">
                    יום זה סומן כיום ללא עבודה.
                  </div>
                )}
              </div>
            ))}
          </div>
            
          {errorMsg && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 mb-4 font-semibold text-center text-sm">
              {errorMsg}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2 text-lg">מספר לינות (₪80 ללילה)</label>
            <input type="number" min="0" className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg font-bold" 
              value={formData.sleeps} onChange={e => setFormData(prev => ({...prev, sleeps: parseInt(e.target.value) || 0}))} />
          </div>
            
          <div className="mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-gray-700 font-bold mb-2 text-lg">הוצאות חריגות (₪)</label>
            <p className="text-sm text-gray-500 mb-2">פרטו במילים מספרים וסיבות (לדוגמה: דלק 50, אוכל 30)</p>
            <textarea placeholder="כתבו כאן את כל ההוצאות החריגות..." className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white" rows={3}
              value={formData.expenses_notes} onChange={e => setFormData(prev => ({...prev, expenses_notes: e.target.value}))}></textarea>
          </div>

          <ReceiptUploader 
            onUploadComplete={(url) => setFormData(prev => ({...prev, receipt_url: url}))} 
            onRemove={() => setFormData(prev => ({...prev, receipt_url: ''}))}
          />
        </div>
      )}

      <button 
        onClick={handleSaveGlobalDraft}
        disabled={reportMutation.isPending || !formData.assignment_id}
        className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 py-4 rounded-xl font-bold text-xl shadow-md transition-colors disabled:opacity-50 mt-4 mb-2"
      >
        💾 שמירת טיוטה
      </button>

      {allDaysCompleted && isLastDayReached && (
        <button 
          onClick={() => {
            // Validation
            const activeShifts = dailyShifts.filter(s => !s.is_absent);
            if (activeShifts.length === 0) {
              setErrorMsg('חובה לדווח לפחות על יום עבודה אחד.');
              return;
            }

            for (let i = 0; i < dailyShifts.length; i++) {
              if (dailyShifts[i].is_absent) continue;
              
              const start = new Date(dailyShifts[i].start_time);
              const end = new Date(dailyShifts[i].end_time);
              if (end <= start) {
                setErrorMsg(`שגיאה ביום ${i + 1}: שעת הסיום חייבת להיות אחרי שעת ההתחלה.`);
                return;
              }
              if (i > 0) {
                // Find the previous active shift
                let prevIdx = i - 1;
                while (prevIdx >= 0 && dailyShifts[prevIdx].is_absent) prevIdx--;
                
                if (prevIdx >= 0) {
                  const prevEnd = new Date(dailyShifts[prevIdx].end_time);
                  if (start < prevEnd) {
                    setErrorMsg(`שגיאה בין יום ${prevIdx + 1} ליום ${i + 1}: לא ניתן להתחיל יום עבודה לפני שהסתיים היום הקודם.`);
                    return;
                  }
                }
              }
            }
            
            const payload = {
              assignment_id: formData.assignment_id,
              expenses: formData.expenses,
              expenses_notes: formData.expenses_notes,
              sleeps: formData.sleeps,
              receipt_url: formData.receipt_url,
              is_draft: false,
              daily_shifts: dailyShifts.map(s => ({
                start_time: new Date(s.start_time).toISOString(),
                end_time: new Date(s.is_absent ? s.start_time : s.end_time).toISOString(),
                is_absent: !!s.is_absent
              }))
            };
            reportMutation.mutate(payload);
          }}
          disabled={reportMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-xl shadow-md transition-colors disabled:bg-gray-400 mt-2"
        >
          {reportMutation.isPending ? 'שולח...' : 'שלח דו"ח כולל (סופי)'}
        </button>
      )}

      {allDaysCompleted && !isLastDayReached && (
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 text-center font-bold text-sm shadow-sm mt-4">
          ניתן לשלוח דו"ח סופי רק ביום האחרון של הטיול או לאחריו. בינתיים אפשר לשמור כטיוטה.
        </div>
      )}
    </div>
  );
}
