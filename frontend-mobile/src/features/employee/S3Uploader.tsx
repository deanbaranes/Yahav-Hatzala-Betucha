import React, { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import axios from 'axios';

export default function S3Uploader({ onUploadComplete }: { onUploadComplete: (url: string) => void }) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data } = await axiosClient.get('/reports/upload-url');
      const formData = new FormData();
      Object.entries(data.fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', file);

      await axios.post(data.url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const s3Url = `${data.url}/${data.fields.key}`;
      onUploadComplete(s3Url);
    } catch (err) {
      console.error('Upload failed', err);
      alert('שגיאה בהעלאת הקובץ. אנא נסה שנית.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-5 text-right" dir="rtl">
      <label className="block text-gray-700 font-bold mb-2 text-lg">קבלת הוצאות (תמונה)</label>
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        disabled={isUploading} 
        className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-700" 
      />
      {isUploading && <p className="text-md text-blue-600 mt-2 font-semibold animate-pulse">מעלה תמונה, אנא המתן...</p>}
    </div>
  );
}
