import NextTripCard from '../../features/employee/NextTripCard';
import { useAuth } from '../../hooks/useAuth';
import { FileText, ExternalLink } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in space-y-6 pb-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-3xl shadow-lg mb-6">
        <h2 className="text-2xl font-black mb-1">שלום {user?.name?.split(' ')[0] || 'עובד יקר'}! 👋</h2>
        <p className="text-blue-100">מוכן ליום עבודה חדש?</p>
      </div>

      <div className="bg-blue-50/80 border border-blue-100 p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-right w-full sm:w-auto">
          <div className="bg-blue-200 text-blue-700 p-3 rounded-full shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 text-lg">טופס 101 מקוון (לשכירים בלבד)</h3>
            <p className="text-sm text-blue-800">על מנת למנוע עיכובי שכר, אנא ודא שמילאת טופס 101 לשנת המס הנוכחית.</p>
            <div className="mt-3 text-xs font-bold bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg text-amber-800 w-fit leading-relaxed flex items-start gap-2 shadow-sm">
              <span className="text-amber-500 text-sm">⚠️</span>
              <div>
                <span className="font-black text-amber-900">שימו לב:</span> קבלנים עצמאיים אינם נדרשים למלא טופס זה. 
                <br className="hidden sm:block" />
                מי שכבר מילא עבור השנה הנוכחית, אין צורך למלא שוב.
              </div>
            </div>
          </div>
        </div>
        <a 
          href="https://tpz.link/hy9tc" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
        >
          <ExternalLink size={18} />
          למילוי הטופס
        </a>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4 px-2">הטיול הבא שלי</h3>
        <NextTripCard />
      </div>
    </div>
  );
}
