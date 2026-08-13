import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import ReportForm from '../../features/employee/ReportForm';
import { History, CheckCircle, Clock, XCircle, MapPin } from 'lucide-react';

export default function Report() {
  const { data: myReports } = useQuery<any[]>({
    queryKey: ['my-reports'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/my-reports');
      return res.data;
    }
  });

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <div className="px-2">
        <h2 className="text-2xl font-black text-gray-900">הגשת דו"ח</h2>
        <p className="text-gray-500">דווח שעות והעלה קבלות הוצאות</p>
      </div>
      
      <ReportForm />

      {myReports && myReports.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-200">
          <details className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <summary className="flex justify-between items-center font-bold text-lg text-gray-700 p-5 cursor-pointer list-none bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <History size={20} className="text-blue-500" /> 
                היסטוריית דיווחים ({myReports.length})
              </div>
              <span className="transition-transform group-open:rotate-180">
                <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
              </span>
            </summary>
            
            <div className="p-5 pt-0 grid gap-3 mt-4">
              {myReports.map(report => (
                <div key={report.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h4 className="font-bold text-gray-800">{report.location}</h4>
                    <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      <Clock size={14} /> 
                      {new Date(report.start_date).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {report.manager_status === 'approved' && (
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <CheckCircle size={14} /> אושר
                      </span>
                    )}
                    {report.manager_status === 'pending' && (
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <Clock size={14} /> ממתין לאישור
                      </span>
                    )}
                    {report.manager_status === 'rejected' && (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <XCircle size={14} /> נדחה
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
