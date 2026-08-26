import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Plus, Search, Trash2, Edit2, Check, X, Truck, Download } from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';

interface Supplier {
  id: string;
  name: string;
  debt_date: string;
  debt_end_date?: string;
  amount: number;
  details?: string;
  includes_vat: boolean;
  is_invoiced: boolean;
  invoice_date?: string;
}

export default function Suppliers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    debt_date: new Date().toISOString().split('T')[0],
    debt_end_date: new Date().toISOString().split('T')[0],
    amount: 0,
    details: '',
    includes_vat: false,
  });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await axiosClient.get('/suppliers/');
      return res.data;
    }
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/employees');
      return res.data;
    }
  });

  const { data: savedContacts = [] } = useQuery<string[]>({
    queryKey: ['supplier-contacts'],
    queryFn: async () => {
      const res = await axiosClient.get('/suppliers/contacts');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => axiosClient.post('/suppliers/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsModalOpen(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => axiosClient.put(`/suppliers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setEditingId(null);
      setIsModalOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => axiosClient.delete(`/suppliers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  });

  const toggleInvoiceMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const newStatus = !supplier.is_invoiced;
      return axiosClient.put(`/suppliers/${supplier.id}`, {
        is_invoiced: newStatus,
        invoice_date: newStatus ? new Date().toISOString().split('T')[0] : null
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  });

  const resetForm = () => {
    setFormData({ name: '', debt_date: new Date().toISOString().split('T')[0], debt_end_date: new Date().toISOString().split('T')[0], amount: 0, details: '', includes_vat: false });
    setEditingId(null);
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      debt_date: supplier.debt_date,
      debt_end_date: supplier.debt_end_date || '',
      amount: supplier.amount,
      details: supplier.details || '',
      includes_vat: supplier.includes_vat ?? false
    });
    setEditingId(supplier.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      debt_end_date: formData.debt_end_date ? formData.debt_end_date : null
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.details && s.details.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalDebt = filteredSuppliers.reduce((sum, s) => sum + (!s.is_invoiced ? s.amount : 0), 0);

  const freelancers = employees.filter(e => e.employment_type === 'עצמאי').map(e => e.full_name);
  const uniqueSupplierNames = Array.from(new Set([...suppliers.map(s => s.name), ...freelancers, ...savedContacts]));

  const handleExport = () => {
    if (!filteredSuppliers || filteredSuppliers.length === 0) return;
    const headers = ['שם ספק', 'תאריך התחלה', 'תאריך סיום', 'פירוט', 'סכום (₪)', 'חשבונית יצאה?', 'תאריך חשבונית'];
    const rows = filteredSuppliers.map((s: Supplier) => [
      s.name,
      new Date(s.debt_date).toLocaleDateString('he-IL'),
      s.debt_end_date ? new Date(s.debt_end_date).toLocaleDateString('he-IL') : '',
      s.details || '',
      s.includes_vat ? s.amount : `${s.amount} (+ מע"מ)`,
      s.is_invoiced ? 'כן' : 'לא',
      s.invoice_date ? new Date(s.invoice_date).toLocaleDateString('he-IL') : ''
    ]);
    exportToCSV(`ספקים_וחובות_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500 font-bold">טוען נתונים...</div>;

  const groupedSuppliers = filteredSuppliers.reduce((acc: Record<string, Supplier[]>, supplier) => {
    if (!acc[supplier.name]) acc[supplier.name] = [];
    acc[supplier.name].push(supplier);
    return acc;
  }, {});

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 flex items-center gap-3">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0"><Truck size={28} /></span>
              ספקים וחובות
            </h1>
            <p className="text-gray-500 text-sm sm:text-base font-medium pr-14">ניהול ספקים, מעקב אחר התחייבויות וחשבוניות</p>
          </div>
          <div className="flex flex-row gap-2 w-full sm:w-auto justify-start sm:justify-end">
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 h-10 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 whitespace-nowrap shrink-0"
            >
              <Plus size={16} /> ספק חדש
            </button>
            <button 
              onClick={handleExport}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-bold text-xs sm:text-sm transition-colors border border-emerald-200 whitespace-nowrap shrink-0"
            >
              <Download size={16} />
              <span className="hidden sm:inline">ייצוא לאקסל</span>
              <span className="sm:hidden">ייצוא</span>
            </button>
          </div>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full border-t border-gray-100 pt-4">
          <div className="bg-red-50 text-red-700 px-4 sm:px-6 py-3 rounded-2xl w-full sm:w-auto sm:min-w-[200px] border border-red-100 text-center">
            <div className="text-xs font-bold opacity-80 mb-1">ס"הכ חובות לספקים</div>
            <div className="text-xl sm:text-2xl font-black">₪{totalDebt.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <input 
            type="text" 
            placeholder="חיפוש ספק או פירוט..."
            className="w-full pl-4 pr-12 py-3 rounded-2xl border-none shadow-sm focus:ring-4 focus:ring-blue-500/20 text-gray-700 font-medium bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute right-4 top-3.5 text-gray-400" size={20} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-2 sm:p-4 font-bold text-gray-600 text-xs sm:text-sm whitespace-nowrap">שם ספק</th>
                <th className="p-2 sm:p-4 font-bold text-gray-600 text-xs sm:text-sm whitespace-nowrap">תאריכים</th>
                <th className="p-2 sm:p-4 font-bold text-gray-600 text-xs sm:text-sm whitespace-nowrap">פירוט</th>
                <th className="p-2 sm:p-4 font-bold text-gray-600 text-xs sm:text-sm whitespace-nowrap">סכום</th>
                <th className="p-2 sm:p-4 font-bold text-gray-600 text-xs sm:text-sm text-center whitespace-nowrap">שולם? (מחיקה)</th>
                <th className="p-2 sm:p-4 font-bold text-gray-600 text-xs sm:text-sm text-left whitespace-nowrap">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(groupedSuppliers).map(([name, group], index) => (
                <React.Fragment key={name}>
                  {index > 0 && (
                    <tr>
                      <td colSpan={6} className="h-8 bg-gray-100 border-y-4 border-white"></td>
                    </tr>
                  )}
                  <tr className="bg-blue-50/80 border-t-2 border-blue-200">
                    <td colSpan={3} className="px-3 py-3 sm:px-5 sm:py-4 font-black text-blue-900 text-base sm:text-xl">
                      {name}
                    </td>
                    <td className="px-3 py-3 sm:px-5 sm:py-4 font-black text-red-600 text-base sm:text-xl whitespace-nowrap">
                      סה"כ: ₪{group.reduce((sum, s) => sum + s.amount, 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="bg-blue-50/80"></td>
                  </tr>
                  {[...group].sort((a, b) => new Date(a.debt_date).getTime() - new Date(b.debt_date).getTime()).map(supplier => (
                    <tr key={supplier.id} className="hover:bg-gray-50/50 transition-colors bg-white">
                      <td className="p-2 sm:p-4 font-bold text-gray-300 text-sm pr-2 sm:pr-8">↳</td>
                      <td className="p-2 sm:p-4 text-gray-600 text-[11px] sm:text-sm">
                        {new Date(supplier.debt_date).toLocaleDateString('he-IL')}
                        {supplier.debt_end_date && <br className="sm:hidden" />}
                        {supplier.debt_end_date && <span className="hidden sm:inline"> - </span>}
                        {supplier.debt_end_date && new Date(supplier.debt_end_date).toLocaleDateString('he-IL')}
                      </td>
                      <td className="p-2 sm:p-4 text-gray-600 text-xs sm:text-sm whitespace-pre-wrap min-w-[120px] sm:min-w-[200px]" title={supplier.details}>
                        {supplier.details || '-'}
                      </td>
                      <td className="p-2 sm:p-4 font-bold text-gray-700 text-xs sm:text-sm whitespace-nowrap">
                        ₪{supplier.amount.toLocaleString()}
                        {supplier.includes_vat === false && <span className="text-[10px] sm:text-xs text-gray-400 font-normal mr-1 block sm:inline">(+ מע״מ)</span>}
                      </td>
                      <td className="p-2 sm:p-4 text-center">
                        <button
                          onClick={() => {
                            if (window.confirm("האם שולם? האם אתה בטוח שברצונך למחוק חוב זה מהמערכת? (לא ניתן לשחזור)")) {
                              deleteMutation.mutate(supplier.id);
                            }
                          }}
                          title="סמן כשולם ומחק"
                          className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 whitespace-nowrap"
                        >
                          <Check size={16} /> <span className="hidden sm:inline">סמן כשולם ומחק</span>
                        </button>
                        {supplier.is_invoiced && supplier.invoice_date && (
                          <div className="text-[10px] text-gray-400 mt-1">
                            {new Date(supplier.invoice_date).toLocaleDateString('he-IL')}
                          </div>
                        )}
                      </td>
                      <td className="p-2 sm:p-4">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <button 
                            onClick={() => handleEdit(supplier)}
                            className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="ערוך"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('האם אתה בטוח שברצונך למחוק ספק/דיווח זה?')) {
                                deleteMutation.mutate(supplier.id);
                              }
                            }}
                            className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="מחק"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400 font-medium">
                    לא נמצאו ספקים מתאימים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">
                {editingId ? 'עריכת ספק' : 'הוספת ספק חדש'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">שם ספק <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  list="supplier-suggestions"
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  autoComplete="off"
                />
                <datalist id="supplier-suggestions">
                  {uniqueSupplierNames.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">מתאריך <span className="text-red-500">*</span></label>
                  <input 
                    type="date" 
                    required
                    className="w-full h-[50px] px-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    value={formData.debt_date}
                    onChange={e => setFormData({...formData, debt_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">עד תאריך <span className="text-gray-400 font-normal text-xs">(רשות)</span></label>
                  <input 
                    type="date" 
                    className="w-full h-[50px] px-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    value={formData.debt_end_date}
                    onChange={e => setFormData({...formData, debt_end_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">סכום (₪)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-left"
                    value={formData.amount === 0 ? '' : formData.amount}
                    placeholder="0"
                    onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                  />
                  <div className="flex items-center gap-2 mt-2 mr-1">
                    <input 
                      type="checkbox" 
                      id="add_vat_note"
                      className="rounded text-blue-600 w-4 h-4"
                      checked={!formData.includes_vat}
                      onChange={e => setFormData({...formData, includes_vat: !e.target.checked})}
                    />
                    <label htmlFor="add_vat_note" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                      הוסף הערת "+ מע״מ" <span className="font-normal text-xs text-gray-500">(הסכום לא כולל מע״מ)</span>
                    </label>
                  </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">פירוט / הערות</label>
                <textarea 
                  rows={3}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all resize-none text-sm"
                  value={formData.details}
                  onChange={e => setFormData({...formData, details: e.target.value})}
                  placeholder="על מה החוב..."
                />
              </div>

              <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  ביטול
                </button>
                <button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'שומר...' : 'שמירה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
