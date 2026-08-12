import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Download, Upload, CheckCircle2, FileText, Trash2, X, RefreshCw, FolderDown, ArrowUpCircle, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function Expenses() {
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const { data: expenses, isLoading } = useQuery<any[]>({
    queryKey: ['expenses', activeTab, currentMonth, currentYear],
    queryFn: async () => {
      const res = await axiosClient.get(`/expenses/?status=${activeTab}&expense_month=${currentMonth}&expense_year=${currentYear}`);
      return res.data;
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      await axiosClient.put(`/expenses/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('expense_month', currentMonth.toString());
        formData.append('expense_year', currentYear.toString());
        await axiosClient.post('/expenses/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      alert('ההוצאות הועלו בהצלחה!');
    } catch (err) {
      alert('שגיאה בהעלאת קבצים');
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const downloadFile = (url: string, filename: string) => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename || 'expense_receipt';
        link.click();
      });
  };

  const downloadAllPending = async () => {
    if (!expenses || expenses.length === 0) return;
    try {
      const zip = new JSZip();
      const folder = zip.folder("expenses_pending");
      
      await Promise.all(expenses.map(async (exp, i) => {
        const response = await fetch(exp.file_url);
        const blob = await response.blob();
        const ext = exp.file_name?.split('.').pop() || 'jpg';
        folder?.file(`receipt_${i+1}.${ext}`, blob);
      }));
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `yahav_expenses_${currentYear}_${currentMonth}_pending.zip`);
    } catch (error) {
      console.error("Error creating zip:", error);
      alert("שגיאה בהורדת הקבצים כ-ZIP");
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth, 1));
  };

  const monthName = currentDate.toLocaleString('he-IL', { month: 'long' });

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="mb-6 relative bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="bg-blue-100 text-blue-700 p-2 rounded-lg shrink-0">
              <FolderDown size={28} />
            </span>
            ניהול הוצאות עסק
          </h1>
          <p className="text-gray-500 text-sm sm:text-base mt-2 font-medium">העלאה, סריקה ומעקב לפי חודשים.</p>
        </div>
        
        {/* Month Selector */}
        <div className="flex items-center gap-4 bg-slate-50 border border-gray-200 p-2 rounded-xl">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600 hover:text-blue-600 shadow-sm border border-transparent hover:border-gray-200">
            <ChevronRight size={20} />
          </button>
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            <div className="text-xs text-gray-500 font-medium mb-0.5 flex items-center gap-1"><Calendar size={12}/> תיקיית חודש</div>
            <div className="font-bold text-lg text-slate-800">{monthName} {currentYear}</div>
          </div>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600 hover:text-blue-600 shadow-sm border border-transparent hover:border-gray-200">
            <ChevronLeft size={20} />
          </button>
        </div>
      </header>

      {/* Upload Zone */}
      <div 
        className={`bg-white border-2 border-dashed rounded-2xl p-8 text-center transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          multiple 
          className="hidden" 
          ref={fileInputRef} 
          onChange={(e) => handleFileUpload(e.target.files)}
          accept="image/*,.pdf"
        />
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="bg-blue-100 text-blue-600 p-4 rounded-full">
            {isUploading ? <RefreshCw className="animate-spin" size={32} /> : <Upload size={32} />}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg mb-1">{isUploading ? 'מעלה קבצים...' : `גרור קבלות לתיקיית ${monthName}`}</h3>
            <p className="text-gray-500 text-sm">ניתן להעלות תמונות או קובצי PDF. אפשר לבחור מספר קבצים יחד.</p>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors"
          >
            בחר קבצים
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button 
            className={`flex-1 py-4 font-bold text-lg transition-colors border-b-2 ${activeTab === 'pending' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('pending')}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              ממתין לטיפול
            </div>
          </button>
          <button 
            className={`flex-1 py-4 font-bold text-lg transition-colors border-b-2 ${activeTab === 'processed' ? 'border-green-600 text-green-700 bg-green-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('processed')}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              הוצאות שטופלו
            </div>
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-slate-50/50 min-h-[400px]">
          {activeTab === 'pending' && expenses && expenses.length > 0 && (
            <div className="flex justify-end mb-4">
              <button 
                onClick={downloadAllPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-bold text-sm shadow-sm transition-colors"
              >
                <FolderDown size={16} />
                הורד הכל כ-ZIP (לסריקה ב'יש חשבונית')
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">טוען נתונים...</div>
          ) : !expenses || expenses.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <CheckCircle2 size={48} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-600">אין הוצאות להצגה.</h3>
              <p className="text-gray-400 mt-1">{activeTab === 'pending' ? 'הכל נקי! אין קבלות שממתינות לסריקה.' : 'טרם סומנו הוצאות כטופלו.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {expenses.map((expense: any) => (
                <div key={expense.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                  <div className="h-40 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                    {expense.file_name?.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <FileText size={48} />
                        <span className="font-bold text-sm">PDF</span>
                      </div>
                    ) : (
                      <img src={expense.file_url} alt="Receipt" className="w-full h-full object-cover" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <a href={expense.file_url} target="_blank" rel="noreferrer" className="bg-white/90 text-gray-800 p-2 rounded-full hover:bg-white hover:text-blue-600" title="צפה מוגדל">
                        <FileText size={20} />
                      </a>
                      <button onClick={() => downloadFile(expense.file_url, expense.file_name)} className="bg-white/90 text-gray-800 p-2 rounded-full hover:bg-white hover:text-emerald-600" title="הורד">
                        <Download size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1" dir="ltr">{new Date(expense.created_at).toLocaleString('he-IL')}</div>
                      <div className="text-sm font-bold text-gray-700 truncate" title={expense.file_name}>{expense.file_name || 'קבלה ללא שם'}</div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      {activeTab === 'pending' ? (
                        <>
                          <button 
                            onClick={() => updateStatus.mutate({ id: expense.id, status: 'processed' })}
                            className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 font-bold py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 size={16} /> סמן כטופל
                          </button>
                          <button 
                            onClick={() => { if(window.confirm('למחוק קבלה זו לחלוטין?')) deleteExpense.mutate(expense.id) }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => updateStatus.mutate({ id: expense.id, status: 'pending' })}
                            className="flex-1 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <ArrowUpCircle size={16} /> החזר לממתין
                          </button>
                          <button 
                            onClick={() => { if(window.confirm('למחוק קבלה זו לחלוטין מהארכיון?')) deleteExpense.mutate(expense.id) }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
