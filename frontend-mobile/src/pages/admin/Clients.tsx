import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Search, Save, Edit2, Trash2, Copy, Check } from 'lucide-react';

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ balance: '', notes: '' });
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

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
    setEditForm({ balance: client.balance || '', notes: client.notes || '' });
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

  const filteredClients = clients?.filter(c => 
    (c.name || '').includes(searchTerm) || 
    (c.contact_person && c.contact_person.includes(searchTerm))
  ).sort((a, b) => {
    if (sortOrder === 'none') return 0;
    const valA = parseBalance(a.balance);
    const valB = parseBalance(b.balance);
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  }) || [];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">ניהול לקוחות</h1>
          <p className="text-gray-500 text-lg mt-2">צפה בכל הלקוחות, עדכן יתרות והערות בזמן אמת.</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
          <Search className="text-gray-400" />
          <input 
            type="text" 
            placeholder="חיפוש לפי שם לקוח או איש קשר..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 text-gray-700"
          />
        </div>
        
        <div className="overflow-x-hidden border-t-0 rounded-b-2xl">
          <table className="w-full table-fixed text-right text-sm">
            <thead>
              <tr className="bg-gradient-to-l from-blue-700 to-cyan-500 text-white shadow-md">
                <th className="px-3 py-4 font-extrabold w-[15%] rounded-tr-lg">שם לקוח</th>
                <th className="px-3 py-4 font-bold w-[12%]">איש קשר</th>
                <th className="px-3 py-4 font-bold w-[22%]">אימייל</th>
                <th className="px-3 py-4 font-bold w-[14%]">טלפון</th>
                <th className="px-3 py-4 font-bold w-[12%] cursor-pointer hover:bg-white/20 transition-colors" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} title="לחץ לשינוי סדר המיון">
                  יתרה {sortOrder === 'asc' ? '↓' : sortOrder === 'desc' ? '↑' : ''}
                </th>
                <th className="px-3 py-4 font-bold w-[17%]">הערות</th>
                <th className="px-3 py-4 font-bold w-[8%] text-center rounded-tl-lg">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredClients.map((client, idx) => (
                <tr key={client.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} hover:bg-blue-50/70 transition-all duration-200 group`}>
                  <td className="px-3 py-3 font-bold text-gray-800 truncate group-hover:text-blue-700 transition-colors" title={client.name}>{client.name}</td>
                  <td className="px-3 py-3 text-slate-600 truncate font-medium" title={client.contact_person || ''}>{client.contact_person || '-'}</td>
                  <td className="px-3 py-3 text-slate-500 truncate" title={client.email || ''}>
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
                  <td className="px-3 py-3 text-slate-600 truncate font-medium" dir="ltr" style={{textAlign: 'right'}}>
                    {client.phone ? <a href={`tel:${client.phone}`} className="hover:text-blue-600 hover:underline">{client.phone}</a> : '-'}
                  </td>
                  
                  <td className="px-3 py-3">
                    {editingId === client.id ? (
                      <input 
                        type="text" 
                        value={editForm.balance}
                        onChange={(e) => setEditForm({...editForm, balance: e.target.value})}
                        className="w-full p-1.5 border-2 border-blue-400 rounded-lg text-left focus:ring-4 focus:ring-blue-500/30 text-xs font-bold"
                        dir="ltr"
                      />
                    ) : (
                      <span className={`inline-block px-2 py-1 rounded-md font-bold truncate max-w-full shadow-sm ${String(client.balance || '').includes('-') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`} dir="ltr" title={client.balance || '0'}>
                        {client.balance || '0'}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-3 py-3">
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
                  
                  <td className="px-3 py-3 text-center">
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
      </div>
    </div>
  );
}
