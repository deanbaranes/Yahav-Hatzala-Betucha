import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      await axiosClient.post('/auth/forgot-password', { email });
    },
    onSuccess: () => setSent(true),
    onError: () => setErrorMsg('אירעה שגיאה. נסה שוב מאוחר יותר.')
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute top-10 -left-10 w-72 h-72 bg-violet-400 rounded-full blur-3xl opacity-40 animate-blob"></div>
      <div className="absolute top-10 -right-10 w-72 h-72 bg-purple-400 rounded-full blur-3xl opacity-40 animate-blob animation-delay-2000"></div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-sm w-full relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <img src={logo} alt="יהב הצלה בטוחה" className="w-24 h-auto mx-auto mb-4 drop-shadow-md" />
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-purple-500 mb-2">
            שחזור סיסמא
          </h1>
          <p className="text-gray-500 font-medium text-sm">הזן את האימייל שהגדרת בהרשמה</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-4">📧</div>
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl font-bold text-sm">
              אם האימייל קיים במערכת — נשלח אליו קישור לאיפוס הסיסמא.
            </div>
            <p className="text-gray-500 text-xs">לא קיבלת? בדוק את תיקיית הספאם.</p>
            <Link to="/login" className="block mt-4 text-violet-600 font-bold hover:underline text-sm">
              חזור למסך הכניסה
            </Link>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-center font-bold text-sm">
                {errorMsg}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-bold mb-1.5 text-sm">כתובת אימייל</label>
                <input
                  type="email"
                  className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all focus:outline-none"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !email}
                className="w-full mt-2 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 text-white py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? 'שולח...' : 'שלח קישור לאיפוס'}
              </button>
            </div>
            <div className="mt-6 text-center">
              <Link to="/login" className="text-gray-500 text-sm font-medium hover:text-violet-600 transition-colors">
                ← חזור למסך הכניסה
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
