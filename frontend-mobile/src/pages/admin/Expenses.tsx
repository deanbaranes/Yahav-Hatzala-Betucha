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

  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const { data: allExpenses, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['expenses', currentMonth, currentYear],
    queryFn: async () => {
      const res = await axiosClient.get(`/expenses/?expense_month=${currentMonth}&expense_year=${currentYear}`);
      return res.data;
    }
  });

  const pendingExpenses = allExpenses?.filter(e => e.status === 'pending') || [];
  const processedExpenses = allExpenses?.filter(e => e.status === 'processed') || [];
  const displayedExpenses = activeTab === 'pending' ? pendingExpenses : processedExpenses;

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

  const handleMarkAllProcessed = async () => {
    if (!pendingExpenses.length) return;
    if (!window.confirm(`האם לסמן את כל ${pendingExpenses.length} ההוצאות כטופלו?`)) return;

    setIsMarkingAll(true);
    try {
      await Promise.all(
        pendingExpenses.map(exp => axiosClient.put(`/expenses/${exp.id}`, { status: 'processed' }))
      );
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    } catch (err) {
      alert('שגיאה בעדכון הסטטוס');
    } finally {
      setIsMarkingAll(false);
    }
  };

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
        await axiosClient.post('/expenses/', formData);
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
    if (!pendingExpenses || pendingExpenses.length === 0) return;
    try {
      const zip = new JSZip();
      const folder = zip.folder("expenses_pending");

      await Promise.all(pendingExpenses.map(async (exp, i) => {
        const response = await fetch(exp.file_url);
        const blob = await response.blob();
        const ext = exp.file_name?.split('.').pop() || 'jpg';
        folder?.file(`receipt_${i + 1}.${ext}`, blob);
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
          <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-blue-100">
            סה"כ בתיקייה (ממתין + טופל): {allExpenses?.length || 0}
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-4 bg-slate-50 border border-gray-200 p-2 rounded-xl">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600 hover:text-blue-600 shadow-sm border border-transparent hover:border-gray-200">
            <ChevronRight size={20} />
          </button>
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            <div className="text-xs text-gray-500 font-medium mb-0.5 flex items-center gap-1"><Calendar size={12} /> תיקיית חודש</div>
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
              ממתין לטיפול ({pendingExpenses.length})
            </div>
          </button>
          <button
            className={`flex-1 py-4 font-bold text-lg transition-colors border-b-2 ${activeTab === 'processed' ? 'border-green-600 text-green-700 bg-green-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('processed')}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              הוצאות שטופלו ({processedExpenses.length})
            </div>
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-slate-50/50 min-h-[400px]">
          {activeTab === 'pending' && pendingExpenses.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-end gap-3 mb-6">
              <button
                onClick={handleMarkAllProcessed}
                disabled={isMarkingAll}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
              >
                {isMarkingAll ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                סמן הכל כטופל
              </button>
              <button
                onClick={downloadAllPending}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-bold text-sm shadow-sm transition-colors"
              >
                <FolderDown size={16} />
                הורד הכל כ-ZIP (לסריקה ב'יש חשבונית')
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">טוען נתונים...</div>
          ) : displayedExpenses.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <CheckCircle2 size={48} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-600">אין הוצאות להצגה.</h3>
              <p className="text-gray-400 mt-1">{activeTab === 'pending' ? 'הכל נקי! אין קבלות שממתינות לסריקה.' : 'טרם סומנו הוצאות כטופלו.'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayedExpenses.map((expense: any) => (
                <div key={expense.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row items-center p-3 gap-4">
                  {/* Thumbnail */}
                  <div className="w-full sm:w-24 h-32 sm:h-24 bg-gray-100 rounded-lg relative overflow-hidden flex-shrink-0 flex items-center justify-center group-hover:ring-2 ring-blue-500/30 transition-all">
                    {expense.file_name?.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex flex-col items-center justify-center text-red-500 gap-1">
                        <FileText size={32} />
                        <span className="font-bold text-[10px]">PDF</span>
                      </div>
                    ) : (
                      <img src={expense.file_url} alt="Receipt" className="w-full h-full object-cover" />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a href={expense.file_url} target="_blank" rel="noreferrer" className="bg-white/90 text-gray-800 p-1.5 rounded-full hover:bg-white hover:text-blue-600" title="צפה מוגדל">
                        <FileText size={16} />
                      </a>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-center min-w-0 w-full">
                    <div className="text-xs text-gray-400 mb-0.5" dir="ltr">{new Date(expense.created_at).toLocaleString('he-IL')}</div>
                    <div className="text-sm font-bold text-gray-700 truncate" title={expense.file_name}>{expense.file_name || 'קבלה ללא שם'}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0">
                    <button
                      onClick={() => downloadFile(expense.file_url, expense.file_name)}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="הורד"
                    >
                      <Download size={18} />
                    </button>

                    {activeTab === 'pending' ? (
                      <>
                        <button
                          onClick={() => updateStatus.mutate({ id: expense.id, status: 'processed' })}
                          className="flex-1 sm:flex-none bg-green-50 text-green-700 hover:bg-green-100 font-bold px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 size={16} /> <span className="sm:hidden lg:inline">סמן כטופל</span>
                        </button>
                        <button
                          onClick={() => { if (window.confirm('למחוק קבלה זו לחלוטין?')) deleteExpense.mutate(expense.id) }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => updateStatus.mutate({ id: expense.id, status: 'pending' })}
                          className="flex-1 sm:flex-none bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ArrowUpCircle size={16} /> <span className="sm:hidden lg:inline">החזר לממתין</span>
                        </button>
                        <button
                          onClick={() => { if (window.confirm('למחוק קבלה זו לחלוטין מהארכיון?')) deleteExpense.mutate(expense.id) }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
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
