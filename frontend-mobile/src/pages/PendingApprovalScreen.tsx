import { Clock, FileText, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PendingApprovalScreen() {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 text-center relative overflow-hidden" dir="rtl">
      {/* Background blobs */}
      <div className="absolute top-10 -left-10 w-72 h-72 bg-yellow-400 rounded-full blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute -bottom-10 right-10 w-72 h-72 bg-amber-400 rounded-full blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-xl max-w-sm w-full relative z-10 animate-fade-in-up">
        
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Clock size={40} className="text-amber-500 animate-pulse" />
        </div>

        <h1 className="text-2xl font-black text-gray-800 mb-2">ממתין לאישור</h1>
        <p className="text-gray-600 font-medium mb-8">
          החשבון שלך נוצר בהצלחה אך עדיין ממתין לאישור מנהל המערכת. 
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <FileText size={24} className="text-blue-600" />
            </div>
          </div>
          <h2 className="font-bold text-blue-900 mb-1">השלמת קליטה למערכת</h2>
          <p className="text-sm text-blue-800 mb-4">
            בזמן שאתה ממתין לאישור, אנא ודא שמילאת <strong className="font-black">טופס 101 מקוון</strong> לשנת המס הנוכחית כדי שנוכל לקלוט אותך למערכת השכר.
          </p>
          <a 
            href="https://tpz.link/hy9tc" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            <FileText size={18} />
            למילוי טופס 101 מקוון
          </a>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full text-gray-500 hover:bg-gray-100 py-3 rounded-xl font-bold transition-colors"
        >
          <LogOut size={18} />
          התנתק וחזור להתחברות
        </button>
      </div>
    </div>
  );
}
