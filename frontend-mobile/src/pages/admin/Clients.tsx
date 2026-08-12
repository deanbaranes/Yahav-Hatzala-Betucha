import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Search, Save, Edit2, Trash2, Copy, Check, Users, Download } from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ balance: '', notes: '', debt_start_date: '', payment_terms: '' });
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(0);
  const limit = 50;

  const PAYMENT_TERMS_OPTIONS = [
    { value: '', label: 'ללא תנאים מיוחדים' },
    { value: 'שוטף + 30', label: 'שוטף + 30' },
    { value: 'שוטף + 60', label: 'שוטף + 60' },
    { value: 'שוטף + 75', label: 'שוטף + 75' },
  ];

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };
  
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };
  
  const queryClient = useQueryClient();

  const { data: clientsData, isLoading } = useQuery<any>({
    queryKey: ['clients', page, searchTerm],
    queryFn: async () => {
      const res = await axiosClient.get(`/clients/?skip=${page * limit}&limit=${limit}&q=${searchTerm}`);
      return res.data;
    },
    placeholderData: (prev: any) => prev // keep old data while fetching new
  });

  const filteredClients = clientsData?.data || [];
  const totalPositive = clientsData?.totalPositive || 0;
  const totalNegative = clientsData?.totalNegative || 0;
  const totalClients = clientsData?.total || 0;
  const totalPages = Math.ceil(totalClients / limit);

  const updateClient = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      await axiosClient.put(`/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditingId(null);
    }
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (confirm('הלקוח נמחק בהצלחה.')) {
        // Just notification
      }
    },
    onError: () => {
      alert('שגיאה במחיקת לקוח: יתכן שיש לו טיולים משויכים במערכת.');
    }
  });

  const handleEditClick = (client: any) => {
    setEditingId(client.id);
    const todayStr = new Date().toISOString().split('T')[0];
    setEditForm({ 
      balance: client.balance || '', 
      notes: client.notes || '',
      debt_start_date: client.debt_start_date ? client.debt_start_date.split('T')[0] : todayStr,
      payment_terms: client.payment_terms || ''
    });
  };

  const handleSaveClick = (id: string) => {
    updateClient.mutate({ id, data: editForm });
  };

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('asc'); // Default sort: highest debt first

  const parseBalance = (balStr: any) => {
    if (!balStr) return 0;
    const cleaned = String(balStr).replace(/,/g, '');
    const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
    if (!numMatch) return 0;
    return parseFloat(numMatch[0]);
  };

  // Client-side sort ONLY on the current page for now. 
  // True global sort would require backend sort params.
  const sortedClients = useMemo(() => {
    if (sortOrder === 'none') return filteredClients;
    return [...filteredClients].sort((a, b) => {
      const valA = parseBalance(a.balance);
      const valB = parseBalance(b.balance);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredClients, sortOrder]);

  if (isLoading) return <div className="p-8 text-center">טוען לקוחות...</div>;

  const getDebtAgeMonths = (dateStr: string) => {
    if (!dateStr) return 0;
    const debtDate = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - debtDate.getTime());
    return diffTime / (1000 * 60 * 60 * 24 * 30.44); // Approx months
  };

  const getRowStyle = (client: any, idx: number) => {
    const balanceNum = parseBalance(client.balance);
    if (client.debt_start_date && balanceNum < 0) {
      const months = getDebtAgeMonths(client.debt_start_date);
      if (months >= 3) return 'bg-red-100/80 hover:bg-red-200/80 border-b border-red-200';
      if (months >= 2) return 'bg-amber-100/80 hover:bg-amber-200/80 border-b border-amber-200';
    }
    return `${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} hover:bg-blue-50/70 border-b border-gray-100`;
  };

  const handleExport = () => {
    if (!filteredClients || filteredClients.length === 0) return;
    const headers = ['שם הלקוח', 'איש קשר', 'טלפון', 'אימייל', 'יתרה (₪)', 'תאריך עדכון', 'תנאי תשלום', 'הערות'];
    const rows = filteredClients.map((c: any) => [
      c.name || '',
      c.contact_person || '',
      c.phone || '',
      c.email || '',
      c.balance || '0',
      c.debt_start_date ? new Date(c.debt_start_date).toLocaleDateString('he-IL') : '',
      c.payment_terms || '',
      c.notes || ''
    ]);
    exportToCSV(`לקוחות_וחובות_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="mb-6 relative bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <span className="bg-blue-100 text-blue-700 p-2 rounded-lg shrink-0">
                <Users size={28} />
              </span>
              ניהול לקוחות
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-2 font-medium">ניהול שוטף, מעקב יתרות וסטטוס גביה.</p>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 h-9 sm:h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-sm transition-colors border border-emerald-200 whitespace-nowrap shrink-0"
          >
            <Download size={16} />
            <span className="hidden sm:inline">ייצוא לאקסל</span>
            <span className="sm:hidden">ייצוא</span>
          </button>
        </div>
        <div className="flex flex-col md:flex-row items-stretch gap-4 w-full border-t border-gray-100 pt-4">
          <div className="flex gap-4 w-full md:w-auto">
            <div className="bg-red-50 px-4 py-3 rounded-xl border border-red-100 text-center flex-1 md:flex-none flex-col justify-center shadow-sm">
              <div className="text-sm font-bold text-red-500 mb-1 whitespace-nowrap">סה"כ חובות (-)</div>
              <div className="text-xl md:text-2xl font-black text-red-700 whitespace-nowrap" dir="ltr">{totalNegative.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₪</div>
            </div>
            <div className="bg-green-50 px-4 py-3 rounded-xl border border-green-100 text-center flex-1 md:flex-none flex-col justify-center shadow-sm">
              <div className="text-sm font-bold text-green-600 mb-1 whitespace-nowrap">סה"כ זכות (+)</div>
              <div className="text-xl md:text-2xl font-black text-green-700 whitespace-nowrap" dir="ltr">+{totalPositive.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₪</div>
            </div>
          </div>
          
          <div className="bg-white px-4 py-2.5 rounded-xl border border-gray-200 text-right w-full md:w-auto flex flex-col justify-center shadow-sm md:mr-auto">
             <div className="font-bold text-gray-700 mb-1 text-xs sm:text-sm">מקרא חובות (לפי תאריך עדכון):</div>
             <div className="flex items-center gap-4 text-xs sm:text-sm font-medium text-gray-600">
               <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-red-100 border border-red-300"></span> חוב ישן (מעל 3 חודשים)</span>
               <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300"></span> חוב מתעכב (מעל חודשיים)</span>
             </div>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row items-center gap-3">
          <div className="flex flex-1 w-full items-center gap-3 bg-white p-2 rounded-lg border border-gray-200">
            <Search className="text-gray-400" />
            <input 
              type="text" 
              placeholder="חיפוש לפי שם לקוח או איש קשר..."
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0); // reset page on search
              }}
              className="w-full bg-transparent border-none focus:ring-0 text-gray-700"
            />
          </div>
          
          <div className="md:hidden w-full flex bg-gray-200 p-1 rounded-lg">
            <button 
              onClick={() => setMobileViewMode('cards')} 
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${mobileViewMode === 'cards' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >כרטיסיות</button>
            <button 
              onClick={() => setMobileViewMode('table')} 
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${mobileViewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >טבלה</button>
          </div>
        </div>
        
        {/* Desktop View / Scrolling Table */}
        <div className={`${mobileViewMode === 'table' ? 'block overflow-x-auto' : 'hidden md:block overflow-x-auto'} border-t-0 rounded-b-2xl`}>
          <table className="w-full text-right text-sm min-w-[800px]">
            <thead>
              <tr className="bg-gradient-to-l from-blue-700 to-cyan-500 text-white shadow-md">
                <th className="px-2 py-2 font-extrabold rounded-tr-lg whitespace-nowrap">שם לקוח</th>
                <th className="px-2 py-2 font-bold whitespace-nowrap w-[100px]">איש קשר</th>
                <th className="px-2 py-2 font-bold whitespace-nowrap w-[140px]">אימייל</th>
                <th className="px-2 py-2 font-bold whitespace-nowrap w-[110px]">טלפון</th>
                <th className="px-2 py-2 font-bold cursor-pointer hover:bg-white/20 transition-colors whitespace-nowrap" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} title="לחץ לשינוי סדר המיון">
                  <div className="flex items-center gap-1">יתרה/חוב {sortOrder === 'asc' ? '↓' : sortOrder === 'desc' ? '↑' : ''}</div>
                </th>
                <th className="px-2 py-2 font-bold whitespace-nowrap">תאריך עדכון</th>
                <th className="px-2 py-2 font-bold whitespace-nowrap">תנאי תשלום</th>
                <th className="px-2 py-2 font-bold whitespace-nowrap">הערות</th>
                <th className="px-2 py-2 font-bold text-center rounded-tl-lg whitespace-nowrap">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sortedClients.map((client: any, idx: number) => (
                <tr key={client.id} className={`${getRowStyle(client, idx)} transition-all duration-200 group`}>
                  <td className="px-2 py-1.5 font-bold text-gray-800 break-words group-hover:text-blue-700 transition-colors">{client.name}</td>
                  <td className="px-2 py-1.5 text-slate-600 font-medium whitespace-nowrap max-w-[100px] truncate" title={client.contact_person}>{client.contact_person || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-500 max-w-[140px]">
                    {client.email ? (
                      <div className="flex items-center gap-1.5">
                        <a href={`mailto:${client.email}`} className="hover:text-blue-600 hover:underline truncate" title={client.email}>{client.email}</a>
                        <button
                          onClick={() => copyEmail(client.email)}
                          className={`flex-shrink-0 p-1 rounded transition-all duration-200 ${
                            copiedEmail === client.email
                              ? 'text-green-600 bg-green-50'
                              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title="העתק אימייל"
                        >
                          {copiedEmail === client.email
                            ? <Check size={13} />
                            : <Copy size={13} />}
                        </button>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 font-medium max-w-[110px]" dir="ltr" style={{textAlign: 'right'}}>
                    {client.phone ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => copyPhone(client.phone)}
                          className={`flex-shrink-0 p-1 rounded transition-all duration-200 ${
                            copiedPhone === client.phone
                              ? 'text-green-600 bg-green-50'
                              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title="העתק טלפון"
                        >
                          {copiedPhone === client.phone
                            ? <Check size={13} />
                            : <Copy size={13} />}
                        </button>
                        <a href={`tel:${client.phone}`} className="hover:text-blue-600 hover:underline">{client.phone}</a>
                      </div>
                    ) : '-'}
                  </td>
                  
                  <td className="px-2 py-1.5">
                    {editingId === client.id ? (
                      <input 
                        type="text" 
                        value={editForm.balance}
                        onChange={(e) => setEditForm({...editForm, balance: e.target.value})}
                        placeholder="סכום יתרה"
                        className="w-full p-1.5 border-2 border-blue-400 rounded-lg text-left focus:ring-4 focus:ring-blue-500/30 text-xs font-bold"
                        dir="ltr"
                      />
                    ) : (
                      <span className={`inline-block px-1.5 py-1 rounded-md font-bold shadow-sm text-xs ${String(client.balance || '').includes('-') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`} dir="ltr">
                        {client.balance || '0'}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-2 py-1.5">
                    {editingId === client.id ? (
                      <input 
                        type="date" 
                        value={editForm.debt_start_date}
                        onChange={(e) => setEditForm({...editForm, debt_start_date: e.target.value})}
                        className="w-full p-1.5 border-2 border-amber-300 rounded-lg focus:ring-4 focus:ring-amber-500/30 text-xs font-bold text-gray-700 bg-amber-50"
                      />
                    ) : (
                      client.debt_start_date ? (
                        <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1.5 rounded-md border border-gray-200 shadow-sm whitespace-nowrap">
                          {new Date(client.debt_start_date).toLocaleDateString('he-IL')}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )
                    )}
                  </td>
                  
                  <td className="px-2 py-1.5">
                    {editingId === client.id ? (
                      <select
                        value={editForm.payment_terms}
                        onChange={(e) => setEditForm({...editForm, payment_terms: e.target.value})}
                        className="w-full p-1.5 border-2 border-purple-400 rounded-lg focus:ring-4 focus:ring-purple-500/30 text-xs font-bold bg-purple-50 text-right"
                        dir="rtl"
                      >
                        <option value="">בחר...</option>
                        <option value="שוטף + 30">שוטף + 30</option>
                        <option value="שוטף + 60">שוטף + 60</option>
                        <option value="שוטף + 90">שוטף + 90</option>
                        <option value="מזומן">מזומן</option>
                      </select>
                    ) : (
                      <span className="text-purple-700 bg-purple-50 px-2 py-1 rounded text-xs font-bold">
                        {client.payment_terms || '-'}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-2 py-1.5">
                    {editingId === client.id ? (
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        placeholder="הערות..."
                        className="w-full p-1.5 border-2 border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-500/30 text-xs font-medium resize-none h-16"
                      />
                    ) : (
                      <div className="text-gray-500 text-xs max-w-[150px] break-words">
                        {client.notes || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {editingId === client.id ? (
                      <button 
                        onClick={() => handleSaveClick(client.id)}
                        className="p-1.5 text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 rounded-lg transition-all shadow-md transform hover:scale-105 active:scale-95"

                        title="שמור שינויים"
                      >
                        <Save size={14} />
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(client)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="ערוך יתרה והערות"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm(`האם אתה בטוח שברצונך למחוק את הלקוח ${client.name}? פעולה זו לא ניתנת לביטול.`)) {
                              deleteClient.mutate(client.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="מחק לקוח"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedClients.length === 0 && (
            <div className="p-8 text-center text-gray-500">לא נמצאו לקוחות מתאימים לחיפוש.</div>
          )}
        </div>

        {/* Mobile View: Cards */}
        <div className={`${mobileViewMode === 'cards' ? 'flex md:hidden' : 'hidden'} flex-col divide-y divide-gray-100 border-t-0 rounded-b-2xl bg-white shadow-inner`}>
          {sortedClients.map((client: any) => (
            <div key={client.id} className={`p-5 flex flex-col gap-4 ${editingId === client.id ? 'bg-blue-50/30' : ''}`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{client.name}</h3>
                  <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1 items-center">
                    {client.contact_person && <span className="font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-700">{client.contact_person}</span>}
                    {client.phone && (
                      <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded" dir="ltr">
                        <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline font-medium">{client.phone}</a>
                        <button
                          onClick={() => copyPhone(client.phone)}
                          className={`flex-shrink-0 p-1 rounded transition-all duration-200 ${
                            copiedPhone === client.phone
                              ? 'text-green-600'
                              : 'text-gray-400 hover:text-blue-600'
                          }`}
                          title="העתק טלפון"
                        >
                          {copiedPhone === client.phone ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  {editingId === client.id ? (
                      <button onClick={() => handleSaveClick(client.id)} className="p-2.5 text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl shadow-md"><Save size={18} /></button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(client)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Edit2 size={18} /></button>
                      <button onClick={() => {
                        if (window.confirm(`האם אתה בטוח שברצונך למחוק את הלקוח ${client.name}?`)) deleteClient.mutate(client.id);
                      }} className="p-2 bg-red-50 text-red-600 rounded-xl"><Trash2 size={18} /></button>
                    </div>
                  )}
                </div>
              </div>

              {client.email && (
                <div className="text-sm flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-slate-400">📧</span>
                    <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline truncate">{client.email}</a>
                  </div>
                  <button
                    onClick={() => copyEmail(client.email)}
                    className={`flex-shrink-0 p-1.5 rounded transition-all duration-200 ${
                      copiedEmail === client.email
                        ? 'text-green-600 bg-green-100'
                        : 'text-gray-500 hover:text-blue-600 hover:bg-blue-100'
                    }`}
                    title="העתק אימייל"
                  >
                    {copiedEmail === client.email ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}

              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">יתרה/חוב:</span>
                  {editingId === client.id ? (
                      <input 
                        type="text" 
                        value={editForm.balance}
                        onChange={(e) => setEditForm({...editForm, balance: e.target.value})}
                        placeholder="סכום"
                        className="w-24 p-1.5 border-2 border-blue-400 rounded-lg text-left text-sm font-bold"
                        dir="ltr"
                      />
                  ) : (
                    <span className={`px-3 py-1 rounded-lg font-bold text-sm shadow-sm ${String(client.balance || '').includes('-') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`} dir="ltr">
                      {client.balance || '0'}
                    </span>
                  )}
                </div>

                {/* תנאי תשלום */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                  <span className="text-sm font-bold text-gray-700">תנאי תשלום:</span>
                  {editingId === client.id ? (
                    <select
                      value={editForm.payment_terms}
                      onChange={(e) => setEditForm({...editForm, payment_terms: e.target.value})}
                      className="p-1.5 border-2 border-purple-400 rounded-lg text-xs font-bold bg-purple-50 text-right"
                      dir="rtl"
                    >
                      {PAYMENT_TERMS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    client.payment_terms
                      ? <span className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">{client.payment_terms}</span>
                      : <span className="text-gray-400 text-xs italic">ללא תנאים מיוחדים</span>
                  )}
                </div>

                {editingId === client.id ? (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                    <span className="text-xs font-bold text-gray-500">תאריך חוב:</span>
                    <input 
                      type="date" 
                      value={editForm.debt_start_date}
                      onChange={(e) => setEditForm({...editForm, debt_start_date: e.target.value})}
                      className="w-32 p-1 border-2 border-amber-300 rounded text-xs bg-amber-50"
                    />
                  </div>
                ) : client.debt_start_date && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                    <span className="text-xs text-gray-500">תאריך חוב:</span>
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">{new Date(client.debt_start_date).toLocaleDateString('he-IL')}</span>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3 mt-1">
                  <span className="text-xs font-bold text-gray-400 block mb-2">הערות:</span>
                  {editingId === client.id ? (
                    <textarea 
                      value={editForm.notes}
                      onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                      className="w-full p-2 border-2 border-blue-400 rounded-lg text-sm bg-white"
                      rows={3}
                    />
                  ) : (
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{client.notes || <span className="text-gray-300 italic">אין הערות</span>}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="p-8 text-center text-gray-500">לא נמצאו לקוחות.</div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button 
            disabled={page === 0} 
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="px-4 py-2 bg-white border border-gray-200 rounded shadow-sm disabled:opacity-50 font-bold"
          >
            הקודם
          </button>
          <div className="text-gray-700 font-bold">
            עמוד {page + 1} מתוך {totalPages}
          </div>
          <button 
            disabled={page >= totalPages - 1} 
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            className="px-4 py-2 bg-white border border-gray-200 rounded shadow-sm disabled:opacity-50 font-bold"
          >
            הבא
          </button>
        </div>
      )}
    </div>
  );
}
