import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

interface TripAdminReportingFormProps {
  assignment: any;
  tripStartDate: string;
  tripEndDate: string;
  onClose: () => void;
}

export default function TripAdminReportingForm({ assignment, tripStartDate, tripEndDate, onClose }: TripAdminReportingFormProps) {
  const queryClient = useQueryClient();
  const [reportDaysCount, setReportDaysCount] = useState(1);
  const [reportDailyShifts, setReportDailyShifts] = useState([{ start_time: tripStartDate.substring(0, 16), end_time: tripEndDate ? tripEndDate.substring(0, 16) : '' }]);

  // When assignment changes, reset form
  useEffect(() => {
    setReportDaysCount(1);
    setReportDailyShifts([{ start_time: tripStartDate.substring(0, 16), end_time: tripEndDate ? tripEndDate.substring(0, 16) : '' }]);
  }, [assignment, tripStartDate, tripEndDate]);

  const submitReportMutation = useMutation({
    mutationFn: async (data: any) => {
      await axiosClient.post('/reports/admin-manual', data);
    },
    onSuccess: () => {
      alert('הדיווח נוסף בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      onClose();
    },
    onError: (err: any) => {
      alert('שגיאה: ' + (err.response?.data?.detail || 'לא ניתן להוסיף דיווח.'));
    }
  });

  if (!assignment) return null;

  return (
    <div className="mt-4 p-4 border border-blue-200 bg-blue-50/50 rounded-lg animate-fade-in text-right">
      <h4 className="font-bold text-blue-800 mb-3">
        הוספת דיווח שעות ידני: {assignment.user?.full_name}
      </h4>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">מספר ימי עבודה (לטיול ארוך)</label>
          <select 
            className="w-full p-2 text-sm border border-gray-300 rounded font-bold bg-white"
            value={reportDaysCount}
            onChange={e => {
              const count = parseInt(e.target.value) || 1;
              setReportDaysCount(count);
              const newShifts = [...reportDailyShifts];
              if (count > newShifts.length) {
                for (let i = newShifts.length; i < count; i++) {
                  newShifts.push({ start_time: '', end_time: '' });
                }
              } else {
                newShifts.splice(count);
              }
              setReportDailyShifts(newShifts);
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7].map(num => (
              <option key={num} value={num}>{num} ימים</option>
            ))}
          </select>
        </div>

        {reportDailyShifts.map((shift, idx) => (
          <div key={idx} className="bg-white p-2 border border-blue-100 rounded shadow-sm">
            <h5 className="text-[10px] font-bold text-blue-800 mb-1">יום עבודה {idx + 1}</h5>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">התחלה</label>
                <input 
                  type="datetime-local" 
                  className="w-full p-1 text-xs border border-gray-300 rounded"
                  value={shift.start_time}
                  onChange={e => {
                    const newS = [...reportDailyShifts];
                    newS[idx].start_time = e.target.value;
                    setReportDailyShifts(newS);
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">סיום</label>
                <input 
                  type="datetime-local" 
                  className="w-full p-1 text-xs border border-gray-300 rounded"
                  value={shift.end_time}
                  onChange={e => {
                    const newS = [...reportDailyShifts];
                    newS[idx].end_time = e.target.value;
                    setReportDailyShifts(newS);
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-blue-100">
          <button 
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
          >
            ביטול
          </button>
          <button 
            disabled={reportDailyShifts.some(s => !s.start_time || !s.end_time) || submitReportMutation.isPending}
            onClick={() => submitReportMutation.mutate({
              assignment_id: assignment.id,
              daily_shifts: reportDailyShifts.map(s => ({
                start_time: new Date(s.start_time).toISOString(),
                end_time: new Date(s.end_time).toISOString()
              })),
              expenses: 0
            })}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded font-bold disabled:opacity-50"
          >
            {submitReportMutation.isPending ? 'שומר...' : 'שמור דיווח'}
          </button>
        </div>
      </div>
    </div>
  );
}
