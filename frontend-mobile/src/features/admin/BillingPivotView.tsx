import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

export default function BillingPivotView() {
  const [view, setView] = useState<'payroll' | 'invoice'>('payroll');
  const queryClient = useQueryClient();
  
  // Mock query for reports.
  const { data: reports, isLoading } = useQuery<any>({ 
    queryKey: ['admin-reports'], 
    queryFn: async () => {
      // return (await axiosClient.get('/admin/reports')).data;
      return [];
    } 
  });

  const billMutation = useMutation({
    mutationFn: (id: string) => axiosClient.patch(`/reports/${id}/bill`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-md text-right" dir="rtl">
      <div className="flex gap-6 mb-6 border-b border-gray-200 pb-4">
        <button 
          onClick={() => setView('payroll')} 
          className={`font-bold text-lg px-2 pb-2 ${view === 'payroll' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          לפי עובד (שכר)
        </button>
        <button 
          onClick={() => setView('invoice')} 
          className={`font-bold text-lg px-2 pb-2 ${view === 'invoice' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          לפי לקוח (חשבוניות)
        </button>
      </div>

      {view === 'invoice' && (
        <div className="animate-fade-in">
          <h3 className="font-bold text-xl mb-4 text-gray-800">תצוגת לקוחות - ממתין לחיוב</h3>
          {/* Mock row structure */}
          <div className="border border-gray-200 p-4 rounded-lg mb-3 shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-lg">לקוח לדוגמה בע"מ</span>
              <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">סה"כ שעות חריגות: 12.5</span>
            </div>
            <div className="text-gray-600 text-sm mb-4">כולל 3 טיולים ב-30 ימים האחרונים.</div>
            <div className="flex justify-end">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold shadow-sm transition-colors">
                סומן כחויב
              </button>
            </div>
          </div>
        </div>
      )}
      
      {view === 'payroll' && (
        <div className="animate-fade-in">
          <h3 className="font-bold text-xl mb-4 text-gray-800">תצוגת עובדים - תגמול ובונוסים</h3>
          {/* Mock row structure */}
          <div className="border border-gray-200 p-4 rounded-lg mb-3 shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-lg">ישראל ישראלי</span>
              <span className="font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">סה"כ שעות חריגות: 15.2</span>
            </div>
            <div className="text-gray-600 text-sm">השתתף ב-5 טיולים החודש.</div>
          </div>
        </div>
      )}
    </div>
  );
}
