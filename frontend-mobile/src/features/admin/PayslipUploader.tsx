import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { UploadCloud, Check, X, File as FileIcon, Loader2 } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
}

interface FileMatch {
  file: File;
  matchedUserId: string | null;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export default function PayslipUploader() {
  const [files, setFiles] = useState<FileMatch[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() === 0 ? 12 : new Date().getMonth());
  const [year, setYear] = useState(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear());
  const [isUploading, setIsUploading] = useState(false);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees', month, year],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/employees', { params: { month, year } });
      return res.data;
    }
  });

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      processFiles(selectedFiles);
    }
  };

  const processFiles = (newFiles: File[]) => {
    const matchedFiles = newFiles.map(file => {
      // Smart matching logic
      const fileName = file.name.toLowerCase();
      let bestMatchId = null;
      let maxScore = 0;
      
      employees.forEach(emp => {
        const nameParts = emp.full_name.toLowerCase().split(' ');
        let score = 0;
        nameParts.forEach(part => {
          if (part.length > 2 && fileName.includes(part)) score++;
        });
        if (score > maxScore) {
          maxScore = score;
          bestMatchId = emp.id;
        }
      });

      return {
        file,
        matchedUserId: maxScore > 0 ? bestMatchId : null,
        status: 'pending' as const
      };
    });

    setFiles(prev => [...prev, ...matchedFiles]);
  };

  const uploadAll = async () => {
    setIsUploading(true);
    const updatedFiles = [...files];
    
    for (let i = 0; i < updatedFiles.length; i++) {
      const f = updatedFiles[i];
      if (f.status === 'success' || !f.matchedUserId) continue;
      
      updatedFiles[i].status = 'uploading';
      setFiles([...updatedFiles]);
      
      try {
        const formData = new FormData();
        formData.append('user_id', f.matchedUserId);
        formData.append('month', month.toString());
        formData.append('year', year.toString());
        formData.append('file', f.file);
        
        await axiosClient.post('/payroll/payslips', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        updatedFiles[i].status = 'success';
      } catch (err: any) {
        updatedFiles[i].status = 'error';
        updatedFiles[i].errorMessage = err.response?.data?.detail || 'שגיאה בהעלאה';
      }
      setFiles([...updatedFiles]);
    }
    setIsUploading(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-gray-800">העלאת תלושי שכר מרוכזת</h2>
        
        <div className="flex gap-4">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border p-2 rounded-lg">
            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="border p-2 rounded-lg">
            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div 
        onDragOver={e => e.preventDefault()} 
        onDrop={handleFileDrop}
        className="border-2 border-dashed border-blue-200 bg-blue-50/50 p-10 rounded-2xl text-center cursor-pointer hover:bg-blue-50 transition-colors"
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <UploadCloud size={48} className="mx-auto text-blue-500 mb-4" />
        <p className="text-lg font-bold text-gray-700">גרור את קובצי ה-PDF של התלושים לכאן</p>
        <p className="text-sm text-gray-500 mt-2">המערכת תסרוק את שמות הקבצים ותשייך אותם אוטומטית לעובדים</p>
        <input type="file" id="file-upload" multiple accept="application/pdf" className="hidden" onChange={handleFileSelect} />
      </div>

      {files.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-gray-700 mb-4">תצוגה מקדימה ואישור:</h3>
          <div className="space-y-3">
            {files.map((f, i) => (
              <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 overflow-hidden">
                  <FileIcon size={20} className="text-red-400 flex-shrink-0" />
                  <p className="text-xs md:text-sm font-medium text-gray-800 truncate" dir="ltr">{f.file.name}</p>
                </div>
                
                <div className="flex items-center gap-2 w-full md:flex-1">
                  <select 
                    value={f.matchedUserId || ''} 
                    onChange={e => {
                      const newFiles = [...files];
                      newFiles[i].matchedUserId = e.target.value;
                      setFiles(newFiles);
                    }}
                    className={`flex-1 p-2 rounded-lg text-sm border ${f.matchedUserId ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}
                    disabled={f.status === 'success' || f.status === 'uploading'}
                  >
                    <option value="">-- בחר עובד ידנית --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>

                  <div className="w-10 flex justify-center flex-shrink-0">
                    {f.status === 'success' && <Check className="text-green-500" />}
                    {f.status === 'error' && <X className="text-red-500" title={f.errorMessage} />}
                    {f.status === 'uploading' && <Loader2 className="animate-spin text-blue-500" />}
                    {f.status === 'pending' && (
                      <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 p-2">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button 
              onClick={uploadAll}
              disabled={isUploading || files.every(f => f.status === 'success')}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              {isUploading ? 'מעלה...' : 'אשר והעלה תלושים'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
