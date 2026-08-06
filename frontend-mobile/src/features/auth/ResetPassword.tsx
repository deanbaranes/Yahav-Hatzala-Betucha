import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import logo from '../../assets/logo.png';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async () => {
      await axiosClient.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'אירעה שגיאה. ייתכן שהקישור פג תוקף.');
    }
  });

  const handleSubmit = () => {
    setErrorMsg('');
    if (newPassword.length < 6) {
      setErrorMsg('הסיסמא חייבת להכיל לפחות 6 תווים.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('הסיסמאות אינן תואמות.');
      return;
    }
    mutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <div className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-2xl text-center font-bold">
          קישור לא תקין. <Link to="/forgot-password" className="underline">בקש קישור חדש</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute top-10 -left-10 w-72 h-72 bg-emerald-400 rounded-full blur-3xl opacity-40 animate-blob"></div>
      <div className="absolute top-10 -right-10 w-72 h-72 bg-teal-400 rounded-full blur-3xl opacity-40 animate-blob animation-delay-2000"></div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-sm w-full relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <img src={logo} alt="יהב הצלה בטוחה" className="w-24 h-auto mx-auto mb-4 drop-shadow-md" />
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 mb-2">
            הגדרת סיסמא חדשה
          </h1>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-2">✅</div>
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl font-bold text-sm">
              הסיסמא עודכנה בהצלחה! מועבר למסך הכניסה...
            </div>
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
                <label className="block text-gray-700 font-bold mb-1.5 text-sm">סיסמא חדשה</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full p-3 pl-10 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all focus:outline-none"
                    placeholder="לפחות 6 תווים"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1.5 text-sm">אימות סיסמא</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full p-3 pl-10 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all focus:outline-none"
                    placeholder="הקלד שוב"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={mutation.isPending || !newPassword || !confirmPassword}
                className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? 'מעדכן...' : 'עדכן סיסמא'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
