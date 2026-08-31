import React, { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function ReceiptUploader({ onUploadComplete, onRemove }: { onUploadComplete: (url: string) => void, onRemove?: () => void }) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadState('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file, encodeURIComponent(file.name));

      const { data } = await axiosClient.post('/reports/upload', formData);

      onUploadComplete(data.url);
      setUploadState('success');

    } catch (err: any) {
      console.error('[ReceiptUploader] Upload failed:', err);
      setErrorMessage(err?.response?.data?.detail || 'שגיאה בהעלאת הקובץ. אנא נסה שנית.');
      setUploadState('error');
    }
  };

  return (
    <div className="mb-5 text-right" dir="rtl">
      <label className="block text-gray-700 font-bold mb-2 text-lg">קבלת הוצאות (תמונה / PDF)</label>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        disabled={uploadState === 'uploading'}
        className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-700 disabled:opacity-50"
      />

      {uploadState === 'uploading' && (
        <p className="flex items-center gap-2 text-blue-600 mt-2 font-semibold animate-pulse">
          <Loader2 size={16} className="animate-spin" /> מעלה תמונה, אנא המתן...
        </p>
      )}

      {uploadState === 'success' && (
        <div className="flex items-center justify-between mt-2 p-2 bg-green-50 rounded border border-green-200">
          <p className="flex items-center gap-2 text-green-700 font-bold text-sm">
            <CheckCircle2 size={16} /> הקבלה הועלתה בהצלחה!
          </p>
          <button 
            onClick={() => {
              setUploadState('idle');
              setErrorMessage('');
              if (onRemove) onRemove();
            }} 
            className="text-red-500 text-sm font-bold hover:text-red-700 transition-colors bg-white px-2 py-1 rounded shadow-sm border border-red-100"
          >
            הסר קובץ
          </button>
        </div>
      )}

      {uploadState === 'error' && (
        <p className="flex items-center gap-2 text-red-600 mt-2 font-semibold">
          <AlertCircle size={16} /> {errorMessage}
        </p>
      )}
    </div>
  );
}
