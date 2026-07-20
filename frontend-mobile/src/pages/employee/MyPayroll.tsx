import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Wallet, Info, FileText } from 'lucide-react';

export default function MyPayroll() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const { data, isLoading } = useQuery<any>({
    queryKey: ['my-payroll', year, month],
    queryFn: async () => {
      const res = await axiosClient.get(`/payroll/my_payroll/${month}/${year}`);
      return res.data;
    }
  });

  return (
    <div className="animate-fade-in pb-10 space-y-6">
      <header className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-3xl shadow-lg">
        <h2 className="text-2xl font-black mb-1 flex items-center gap-2"><Wallet size={24} /> השכר שלי</h2>
        <p className="text-emerald-100 font-medium">צפייה בריכוז השעות והתגמולים שלך.</p>
      </header>

      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <button onClick={nextMonth} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 font-bold text-gray-600">&gt;</button>
        <h2 className="text-lg font-black text-gray-800">
          {currentDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={prevMonth} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 font-bold text-gray-600">&lt;</button>
      </div>

      <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-2xl flex gap-3 text-sm font-medium shadow-sm">
        <Info size={24} className="flex-shrink-0 text-blue-500" />
        <p>
          הנתונים המוצגים כאן מתבססים על דיווחי השעות שהזנת ואושרו על ידי ההנהלה. ייתכנו שינויים בגין ניכויי מס ועדכוני רואה חשבון בתלוש הסופי.
        </p>
      </div>

      <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-800">
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center gap-2">
          <FileText size={18} className="text-emerald-400" />
          <h3 className="font-bold text-white">סיכום חודשי - {month}/{year}</h3>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400 animate-pulse font-bold">מייצר דוח ממוכן...</div>
          ) : (
            <pre className="text-emerald-50 font-mono text-sm leading-relaxed whitespace-pre-wrap" dir="rtl">
              {data?.report || 'אין נתונים לחודש זה.'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
