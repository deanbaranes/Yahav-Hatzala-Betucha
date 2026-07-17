import React, { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function S3Uploader({ onUploadComplete }: { onUploadComplete: (url: string) => void }) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadState('uploading');
    setErrorMessage('');

    try {
      // Step 1: Get pre-signed URL from our backend
      const { data } = await axiosClient.get('/reports/upload-url');

      // Step 2: POST directly to S3 with the pre-signed data
      const formData = new FormData();
      Object.entries(data.fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', file);

      await axios.post(data.url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Step 3: Construct the final S3 URL and notify parent
      const s3Url = `${data.url}/${data.fields.key}`;
      onUploadComplete(s3Url);
      setUploadState('success');

    } catch (err: any) {
      // Structured error logging for production debugging
      const isS3Error = err?.config?.url?.includes('amazonaws.com');
      const errMsg = isS3Error
        ? 'שגיאה בהעלאה ל-S3. ייתכן שהתמונה גדולה מדי או שיש בעיית חיבור.'
        : (err?.response?.data?.detail || 'שגיאה בהעלאת הקובץ. אנא נסה שנית.');

      console.error('[S3Uploader] Upload failed:', {
        stage: isS3Error ? 's3_post' : 'presign_request',
        status: err?.response?.status,
        detail: err?.response?.data?.detail || err?.message,
        file_name: file.name,
        file_size: file.size,
      });

      setErrorMessage(errMsg);
      setUploadState('error');
    }
  };

  return (
    <div className="mb-5 text-right" dir="rtl">
      <label className="block text-gray-700 font-bold mb-2 text-lg">קבלת הוצאות (תמונה)</label>
      <input
        type="file"
        accept="image/*"
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
        <p className="flex items-center gap-2 text-green-600 mt-2 font-semibold">
          <CheckCircle2 size={16} /> הקבלה הועלתה בהצלחה!
        </p>
      )}

      {uploadState === 'error' && (
        <p className="flex items-center gap-2 text-red-600 mt-2 font-semibold">
          <AlertCircle size={16} /> {errorMessage}
        </p>
      )}
    </div>
  );
}
