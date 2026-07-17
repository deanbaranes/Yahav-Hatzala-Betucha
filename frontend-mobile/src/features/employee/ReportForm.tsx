import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import S3Uploader from './S3Uploader';

export default function ReportForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ start_time: '', end_time: '', expenses: 0, receipt_url: '', assignment_id: '' });
  const [errorMsg, setErrorMsg] = useState('');

  const reportMutation = useMutation({
    mutationFn: (data: any) => axiosClient.post('/reports', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['pending-reports'] });
      alert('הדיווח נשלח בהצלחה');
      setFormData({ start_time: '', end_time: '', expenses: 0, receipt_url: '', assignment_id: '' });
      navigate('/');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'שגיאה בשליחת הדו"ח. אנא נסה שנית.');
    }
  });

  const { data: pendingAssignments, isLoading } = useQuery<any[]>({
    queryKey: ['pending-reports'],
    queryFn: async () => {
      const res = await axiosClient.get('/reports/my-pending-reports');
      return res.data;
    }
  });

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 text-right" dir="rtl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">דיווח שעות והוצאות</h2>
      
      <div className="mb-4">
        <label className="block text-gray-700 font-bold mb-2 text-lg">שעת התחלה</label>
        <input type="datetime-local" className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg" 
          value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 font-bold mb-2 text-lg">שעת סיום</label>
        <input type="datetime-local" className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg" 
          value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
      </div>
        
      <div className="mb-4">
        <label className="block text-gray-700 font-bold mb-2 text-lg">הוצאות (₪)</label>
        <input type="number" placeholder="0.00" className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg" 
          value={formData.expenses || ''} onChange={e => setFormData({...formData, expenses: parseFloat(e.target.value)})} />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 font-bold mb-2 text-lg">בחר טיול לדיווח</label>
        {isLoading ? (
          <div className="text-gray-500">טוען טיולים...</div>
        ) : pendingAssignments?.length === 0 ? (
          <div className="text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200">
            אין טיולים הממתינים לדיווח.
          </div>
        ) : (
          <select 
            className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg" 
            value={formData.assignment_id} 
            onChange={e => setFormData({...formData, assignment_id: e.target.value})}
          >
            <option value="" disabled>-- בחר טיול --</option>
            {pendingAssignments?.map(a => (
              <option key={a.assignment_id} value={a.assignment_id}>
                {a.location} | {new Date(a.start_date).toLocaleDateString('he-IL')} | {a.role === 'general' || !a.role ? 'כללי' : a.role}
              </option>
            ))}
          </select>
        )}
      </div>

      <S3Uploader onUploadComplete={(url) => setFormData({...formData, receipt_url: url})} />

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 mb-4 font-semibold text-center mt-4 text-sm">
          {errorMsg}
        </div>
      )}

      <button 
        onClick={() => reportMutation.mutate(formData)}
        disabled={reportMutation.isPending || !formData.start_time || !formData.end_time || !formData.assignment_id}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-xl shadow-md transition-colors disabled:bg-gray-400 mt-4"
      >
        {reportMutation.isPending ? 'שולח...' : 'שלח דו"ח'}
      </button>
    </div>
  );
}
