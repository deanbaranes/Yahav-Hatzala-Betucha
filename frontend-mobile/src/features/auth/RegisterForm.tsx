import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import logo from '../../assets/logo.png';

export default function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    
    const nameRegex = /^[א-תa-zA-Z\s'-]+$/;
    if (!nameRegex.test(fullName)) {
      setErrorMsg('השם יכול להכיל רק אותיות, רווחים ומקפים. ללא תווים מיוחדים או מספרים.');
      return;
    }
    
    const phoneRegex = /^05\d{8}$/;
    if (!phoneRegex.test(phone)) {
      setErrorMsg('מספר הטלפון חייב להכיל בדיוק 10 ספרות ולהתחיל ב-05.');
      return;
    }
    
    if (nationalId && !/^\d{9}$/.test(nationalId)) {
      setErrorMsg('תעודת זהות חייבת להכיל בדיוק 9 ספרות.');
      return;
    }
    
    if (password.length < 6) {
      setErrorMsg('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('כתובת האימייל אינה תקינה.');
      return;
    }

    registerMutation.mutate();
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post('/auth/register', {
        full_name: fullName,
        phone: phone,
        national_id: nationalId || undefined,
        password: password,
        email: email || undefined,
        role: 'employee'
      });
      return res.data;
    },
    onSuccess: () => {
      // Direct them to the beautiful pending screen which has the Form 101 link
      navigate('/pending');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'אירעה שגיאה בהרשמה. ייתכן שהמספר או האימייל כבר קיימים במערכת.');
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden" dir="rtl">
      {/* Dynamic Background Elements */}
      <div className="absolute top-10 -left-10 w-72 h-72 bg-emerald-400 rounded-full blur-3xl opacity-40 animate-blob"></div>
      <div className="absolute top-10 -right-10 w-72 h-72 bg-teal-400 rounded-full blur-3xl opacity-40 animate-blob animation-delay-2000"></div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-sm w-full relative z-10 animate-fade-in-up">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="יהב הצלה בטוחה" className="w-24 h-auto mx-auto mb-4 drop-shadow-md" />
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 mb-2">הרשמת עובד חדש</h1>
          <p className="text-gray-500 font-medium text-sm">הזן פרטים כדי להצטרף לצוות</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50/90 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-center font-bold text-sm shadow-sm animate-fade-in">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 font-bold mb-1.5 text-sm">שם מלא</label>
            <input 
              type="text" 
              className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all focus:outline-none" 
              placeholder="ישראל ישראלי"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1.5 text-sm">מספר טלפון</label>
            <input 
              type="tel" 
              className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all focus:outline-none placeholder-gray-400" 
              placeholder="050-0000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1.5 text-sm">תעודת זהות <span className="text-gray-400 font-normal text-xs">(לצורך חיבור לתלושי שכר)</span></label>
            <input 
              type="text" 
              className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all focus:outline-none placeholder-gray-400" 
              placeholder="9 ספרות"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1.5 text-sm">סיסמה</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full p-3 pl-12 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all focus:outline-none" 
                placeholder="בחר סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-600 transition-colors p-1"
                title={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1.5 text-sm">
              אימייל <span className="text-gray-400 font-normal text-xs">(לשחזור סיסמא — מומלץ)</span>
            </label>
            <input
              type="email"
              className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all focus:outline-none"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
          </div>

          <button 
            onClick={handleSubmit}
            disabled={registerMutation.isPending || !phone || !password || !fullName}
            className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {registerMutation.isPending ? 'נרשם...' : 'הירשם עכשיו'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm font-medium">
            כבר יש לך חשבון?{' '}
            <Link to="/login" className="text-emerald-600 font-bold hover:underline">
              התחבר כאן
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
