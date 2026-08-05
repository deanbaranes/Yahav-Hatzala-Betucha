import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { FileSignature, Download, Calendar } from 'lucide-react';

export default function MyPayslips() {
  const { data: payslips = [], isLoading } = useQuery<any[]>({
    queryKey: ['my-payslips'],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/my_payslips');
      return res.data;
    }
  });

  // Limit to the last 2 payslips
  const recentPayslips = payslips.slice(0, 2);

  return (
    <div className="animate-fade-in pb-10 space-y-6" dir="rtl">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-3xl shadow-lg">
        <h2 className="text-2xl font-black mb-1 flex items-center gap-2"><FileSignature size={24} /> התלושים שלי</h2>
        <p className="text-blue-100 font-medium">צפייה בתלושי השכר הרשמיים שהופקו עבורך (חודשיים אחרונים).</p>
      </header>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 font-bold animate-pulse">טוען תלושים...</div>
      ) : recentPayslips.length > 0 ? (
        <div className="space-y-4">
          {recentPayslips.map((payslip) => (
            <div key={payslip.id} className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-800">
                    תלוש שכר - {payslip.month.toString().padStart(2, '0')}/{payslip.year}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">הופק ונחתם על ידי הנהלת החשבונות</p>
                </div>
              </div>
              
              <a 
                href={payslip.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all w-full md:w-auto"
              >
                <Download size={20} /> הורד תלוש PDF
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSignature size={32} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">אין תלושים זמינים</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            עדיין לא הועלו תלושי שכר עבורך. במידה וחסר לך תלוש ישן יותר, אנא פנה להנהלה.
          </p>
        </div>
      )}
    </div>
  );
}
