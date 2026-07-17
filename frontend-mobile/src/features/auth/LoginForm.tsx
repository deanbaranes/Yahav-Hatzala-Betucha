import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

export default function LoginForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: async () => {
      // Create FormData as OAuth2PasswordRequestForm expects it
      const formData = new FormData();
      formData.append('username', phone);
      formData.append('password', password);
      
      const res = await axiosClient.post('/auth/login', formData);
      return res.data;
    },
    onSuccess: (data) => {
      // Store token and redirect to trigger useAuth check
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role); // In a real app we decode the JWT, but saving here for quick mock
      
      // Reload or navigate to root so the App Router processes the redirect correctly
      window.location.href = '/'; 
    },
    onError: () => {
      setErrorMsg('מספר טלפון או סיסמה שגויים');
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden" dir="rtl">
      {/* Dynamic Background Elements */}
      <div className="absolute top-10 -left-10 w-72 h-72 bg-blue-400 rounded-full blur-3xl opacity-40 animate-blob"></div>
      <div className="absolute top-10 -right-10 w-72 h-72 bg-cyan-400 rounded-full blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-10 left-1/2 w-72 h-72 bg-sky-400 rounded-full blur-3xl opacity-40 animate-blob animation-delay-4000"></div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-sm w-full relative z-10 animate-fade-in-up">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="יהב הצלה בטוחה" className="w-32 h-auto mx-auto mb-4 drop-shadow-md hover:scale-105 transition-transform duration-300" />
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 mb-2">יהב הצלה בטוחה</h1>
          <p className="text-gray-500 font-medium">ברוכים הבאים למערכת</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50/90 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-center font-bold text-sm shadow-sm animate-fade-in">
            {errorMsg}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">מספר טלפון</label>
            <input 
              type="tel" 
              className="w-full p-3.5 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all focus:outline-none placeholder-gray-400 font-medium" 
              placeholder="050-0000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">סיסמה</label>
            <input 
              type="password" 
              className="w-full p-3.5 border border-gray-200/80 rounded-xl bg-white/60 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all focus:outline-none placeholder-gray-400 font-medium text-left" 
              placeholder="הכנס סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </div>

          <button 
            onClick={() => loginMutation.mutate()}
            disabled={loginMutation.isPending || !phone || !password}
            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loginMutation.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                מתחבר...
              </span>
            ) : 'היכנס למערכת'}
          </button>
        </div>
      </div>
    </div>
  );
}
