import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState('');

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
                      <div className="text-sm">
                        <span className="font-semibold">התחלה:</span> {new Date(report.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">סיום:</span> {new Date(report.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-black text-lg ${report.overtime_decimal > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {report.overtime_decimal > 0 ? `+${report.overtime_decimal}` : '0'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-gray-700">₪{report.expenses}</span>
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
