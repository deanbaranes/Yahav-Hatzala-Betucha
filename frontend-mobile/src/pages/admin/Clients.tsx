import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Search, Save, Edit2, Trash2, Copy, Check, Users } from 'lucide-react';

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ balance: '', notes: '', debt_start_date: '' });
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };
  
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery<any[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await axiosClient.get('/clients/');
      return res.data;
    }
  });

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
    setEditForm({ 
      balance: client.balance || '', 
      notes: client.notes || '',
      debt_start_date: client.debt_start_date ? client.debt_start_date.split('T')[0] : ''
    });
  };

  const handleSaveClick = (id: string) => {
    updateClient.mutate({ id, data: editForm });
  };

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('asc'); // Default sort: highest debt first

  if (isLoading) return <div className="p-8 text-center">טוען לקוחות...</div>;

  const parseBalance = (balStr: any) => {
    if (!balStr) return 0;
    const cleaned = String(balStr).replace(/,/g, '');
    const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
    if (!numMatch) return 0;
    return parseFloat(numMatch[0]);
  };

  const totalPositive = clients?.reduce((acc: number, c: any) => {
    const val = parseBalance(c.balance);
    return val > 0 ? acc + val : acc;
  }, 0) || 0;

  const totalNegative = clients?.reduce((acc: number, c: any) => {
    const val = parseBalance(c.balance);
    return val < 0 ? acc + val : acc;
  }, 0) || 0;

  const filteredClients = clients?.filter(c => 
    (c.name || '').includes(searchTerm) || 
    (c.contact_person && c.contact_person.includes(searchTerm))
  ).sort((a, b) => {
    if (sortOrder === 'none') return 0;
    const valA = parseBalance(a.balance);
    const valB = parseBalance(b.balance);
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  }) || [];

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

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="bg-blue-100 text-blue-700 p-2 rounded-lg">
              <Users size={28} />
            </span>
            ניהול לקוחות
          </h1>
          <p className="text-gray-500 text-base mt-2 font-medium">ניהול שוטף, מעקב יתרות וסטטוס גביה.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-red-50 px-6 py-3 rounded-xl border border-red-100 text-center min-w-[150px] shadow-sm">
            <div className="text-sm font-bold text-red-500 mb-1">סה"כ חובות (-)</div>
            <div className="text-2xl font-black text-red-700" dir="ltr">{totalNegative.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₪</div>
          </div>
          <div className="bg-green-50 px-6 py-3 rounded-xl border border-green-100 text-center min-w-[150px] shadow-sm">
            <div className="text-sm font-bold text-green-500 mb-1">סה"כ זכות (+)</div>
            <div className="text-2xl font-black text-green-700" dir="ltr">+{totalPositive.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₪</div>
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        
        {/* Desktop View: Table */}
        <div className={`${mobileViewMode === 'table' ? 'block' : 'hidden md:block'} border-t-0 rounded-b-2xl`}>
          <table className="w-full text-right text-sm table-fixed">
            <thead>
              <tr className="bg-gradient-to-l from-blue-700 to-cyan-500 text-white shadow-md">
                <th className="px-2 py-4 font-extrabold rounded-tr-lg w-[18%] truncate">שם לקוח</th>
                <th className="px-2 py-4 font-bold w-[12%] truncate">איש קשר</th>
                <th className="px-2 py-4 font-bold w-[18%] truncate">אימייל</th>
                <th className="px-2 py-4 font-bold w-[12%] truncate">טלפון</th>
                <th className="px-2 py-4 font-bold w-[12%] cursor-pointer hover:bg-white/20 transition-colors truncate" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} title="לחץ לשינוי סדר המיון">
                  <div className="flex items-center gap-1">יתרה/חוב {sortOrder === 'asc' ? '↓' : sortOrder === 'desc' ? '↑' : ''}</div>
                </th>
                <th className="px-2 py-4 font-bold w-[18%] truncate">הערות</th>
                <th className="px-2 py-4 font-bold w-[10%] text-center rounded-tl-lg">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredClients.map((client, idx) => (
                <tr key={client.id} className={`${getRowStyle(client, idx)} transition-all duration-200 group`}>
                  <td className="px-2 py-3 font-bold text-gray-800 truncate group-hover:text-blue-700 transition-colors" title={client.name}>{client.name}</td>
                  <td className="px-2 py-3 text-slate-600 truncate font-medium" title={client.contact_person || ''}>{client.contact_person || '-'}</td>
                  <td className="px-2 py-3 text-slate-500 truncate" title={client.email || ''}>
                    {client.email ? (
                      <div className="flex items-center gap-1.5">
                        <a href={`mailto:${client.email}`} className="hover:text-blue-600 hover:underline truncate">{client.email}</a>
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
                  <td className="px-2 py-3 text-slate-600 truncate font-medium" dir="ltr" style={{textAlign: 'right'}}>
                    {client.phone ? <a href={`tel:${client.phone}`} className="hover:text-blue-600 hover:underline">{client.phone}</a> : '-'}
                  </td>
                  
                  <td className="px-2 py-3 truncate">
                    {editingId === client.id ? (
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          value={editForm.balance}
                          onChange={(e) => setEditForm({...editForm, balance: e.target.value})}
                          placeholder="סכום יתרה"
                          className="w-full p-1.5 border-2 border-blue-400 rounded-lg text-left focus:ring-4 focus:ring-blue-500/30 text-xs font-bold"
                          dir="ltr"
                        />
                        <div className="text-[10px] text-gray-500 font-bold mb-1 text-right">תאריך תחילת חוב:</div>
                        <input 
                          type="date" 
                          value={editForm.debt_start_date}
                          onChange={(e) => setEditForm({...editForm, debt_start_date: e.target.value})}
                          className="w-full p-1 border-2 border-amber-300 rounded-lg focus:ring-4 focus:ring-amber-500/30 text-xs font-bold text-gray-700 bg-amber-50"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 items-end">
                        <span className={`inline-block px-2 py-1 rounded-md font-bold truncate max-w-full shadow-sm ${String(client.balance || '').includes('-') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`} dir="ltr" title={client.balance || '0'}>
                          {client.balance || '0'}
                        </span>
                        {client.debt_start_date && (
                          <span className="text-[10px] font-bold text-gray-500 bg-white/60 px-1.5 rounded-full border border-gray-200 shadow-sm" title="תאריך היווצרות החוב">
                            {new Date(client.debt_start_date).toLocaleDateString('he-IL')}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-2 py-3 truncate">
                    {editingId === client.id ? (
                      <textarea 
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        className="w-full p-1.5 border-2 border-blue-400 rounded-lg focus:ring-4 focus:ring-blue-500/30 text-xs shadow-sm"
                        rows={2}
                      />
                    ) : (
                      <div className="text-xs text-slate-500 line-clamp-2 group-hover:line-clamp-none transition-all duration-300 bg-white/50 p-1 rounded" title={client.notes || ''}>
                        {client.notes || '-'}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-2 py-3 text-center">
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
          {filteredClients.length === 0 && (
            <div className="p-8 text-center text-gray-500">לא נמצאו לקוחות מתאימים לחיפוש.</div>
          )}
        </div>

        {/* Mobile View: Cards */}
        <div className={`${mobileViewMode === 'cards' ? 'flex md:hidden' : 'hidden'} flex-col divide-y divide-gray-100 border-t-0 rounded-b-2xl bg-white shadow-inner`}>
          {filteredClients.map((client) => (
            <div key={client.id} className={`p-5 flex flex-col gap-4 ${editingId === client.id ? 'bg-blue-50/30' : ''}`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{client.name}</h3>
                  <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1 items-center">
                    {client.contact_person && <span className="font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-700">{client.contact_person}</span>}
                    {client.phone && <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline font-medium bg-blue-50 px-2 py-0.5 rounded" dir="ltr">{client.phone}</a>}
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
                <div className="text-sm flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-400">📧</span>
                  <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline truncate flex-1">{client.email}</a>
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
    </div>
  );
}
