import { useState } from 'react';
import { Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { FileText, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function BillingPivotView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showOnlyReady, setShowOnlyReady] = useState(false);
  const [showInvoiced, setShowInvoiced] = useState(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed for backend
  const queryClient = useQueryClient();

  const bulkBillMutation = useMutation({
    mutationFn: async ({ clientId, year, month }: { clientId: string, year: number, month: number }) => {
      await axiosClient.put(`/trips/bulk-bill/${clientId}/${year}/${month}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      alert('החיוב בוצע בהצלחה! כל הטיולים סומנו כ"הוצאה חשבונית".');
    },
    onError: (err: any) => {
      alert('שגיאה: ' + (err.response?.data?.detail || 'לא ניתן לסמן חיוב.'));
    }
  });

  // Invoice real query
  const { data: billingStatus, isLoading: isLoadingBilling } = useQuery<any[]>({
    queryKey: ['billing-status', year, month],
    queryFn: async () => {
      return (await axiosClient.get(`/trips/billing-status/${year}/${month}`)).data;
    }
  });

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'מוכן לחיוב': return 'text-green-700 bg-green-100 border border-green-200';
      case 'חויב במלואו': return 'text-blue-700 bg-blue-100 border border-blue-200';
      case 'פעיל': return 'text-yellow-700 bg-yellow-100 border border-yellow-200';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md text-right" dir="rtl">
      <div className="flex items-center justify-between mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <button onClick={nextMonth} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold">&gt;</button>
        <h2 className="text-xl font-bold text-gray-800">
          {currentDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={prevMonth} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold">&lt;</button>
      </div>

      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-xl text-gray-800">סטטוס חיובים - לקוחות</h3>
          <button 
            onClick={() => setShowOnlyReady(!showOnlyReady)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm border ${showOnlyReady ? 'bg-green-600 text-white border-green-700 hover:bg-green-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            <Filter size={16} />
            {showOnlyReady ? 'מציג: מוכנים לחיוב בלבד' : 'סנן: מוכנים לחיוב'}
          </button>
        </div>
          
          {isLoadingBilling ? (
            <div className="text-center py-10 text-gray-500">טוען נתונים...</div>
          ) : billingStatus?.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">אין טיולים בחודש זה.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {billingStatus
                  ?.filter(client => client.status !== 'חויב במלואו' && client.status !== 'הופקה חשבונית')
                  .filter(client => !showOnlyReady || client.status === 'מוכן לחיוב')
                  .map(client => (
                    <div key={client.client_id} className={`border p-4 rounded-xl shadow-sm hover:shadow-md transition-all ${client.status === 'מוכן לחיוב' ? 'border-green-300 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-lg text-gray-800">{client.client_name}</span>
                        <span className={`font-bold px-3 py-1 rounded-full text-xs shadow-sm ${getStatusColor(client.status)}`}>
                          {client.status}
                        </span>
                      </div>
                      
                      <div className="space-y-1 mb-4 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>סה"כ טיולים החודש:</span>
                          <span className="font-bold text-gray-800">{client.total_trips}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>טיולים שהסתיימו:</span>
                          <span className="font-bold text-gray-800">{client.completed_trips}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>הוצאה חשבונית:</span>
                          <span className="font-bold text-blue-600">{client.invoiced_trips}</span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-gray-200">
                          <div className="text-xs font-bold text-gray-800 mb-1">תוספות לחיוב (מדיווחי עובדים מאושרים):</div>
                          <div className="flex justify-between text-gray-600">
                            <span>שעות נוספות:</span>
                            <span className={`font-bold ${client.total_overtime > 0 ? 'text-red-600' : 'text-gray-500'}`}>{client.total_overtime} שעות</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>הוצאות / נסיעות:</span>
                            <span className={`font-bold ${client.total_expenses > 0 ? 'text-red-600' : 'text-gray-500'}`}>₪{client.total_expenses}</span>
                          </div>
                        </div>

                        {client.roles_summary && Object.keys(client.roles_summary).length > 0 && (
                          <div className="pt-2 mt-2 border-t border-gray-200">
                            <div className="text-xs font-bold text-gray-800 mb-2">פירוט כוח אדם לחיוב:</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(client.roles_summary).map(([role, count]) => (
                                <span key={role} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md font-bold">
                                  {role}: {String(count)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {client.status === 'מוכן לחיוב' && (
                        <div className="flex flex-col gap-2 pt-3 border-t border-green-100">
                          <div className="text-sm font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            ✨ כל הטיולים לחודש זה הסתיימו. ניתן להוציא חשבונית.
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`האם אתה בטוח שברצונך לסמן את כל הטיולים של ${client.client_name} לחודש זה כחויבו?`)) {
                                bulkBillMutation.mutate({ clientId: client.client_id, year, month });
                              }
                            }}
                            disabled={bulkBillMutation.isPending}
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                          >
                            <FileText size={16} />
                            {bulkBillMutation.isPending ? 'מעדכן...' : 'סמן הכל כיצאה חשבונית'}
                          </button>
                        </div>
                      )}
                      {client.status === 'פעיל' && (
                        <div className="flex justify-end pt-3 border-t border-gray-100">
                          <div className="text-sm text-gray-500 font-medium">
                            יש עוד {client.total_trips - client.completed_trips} טיולים שטרם הסתיימו החודש.
                          </div>
                        </div>
                      )}
                    </div>
                ))}
              </div>

              {showOnlyReady && billingStatus?.filter(c => c.status === 'מוכן לחיוב').length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                  אין לקוחות המוכנים להוצאת חשבונית בחודש זה.
                </div>
              )}

              {(billingStatus?.filter(client => client.status === 'חויב במלואו' || client.status === 'הופקה חשבונית')?.length || 0) > 0 && (
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <button 
                    onClick={() => setShowInvoiced(!showInvoiced)}
                    className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-800 p-4 rounded-xl font-bold transition-colors border border-blue-200"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle size={20} />
                      לקוחות שחויבו במלואו החודש ({billingStatus?.filter(client => client.status === 'חויב במלואו' || client.status === 'הופקה חשבונית').length || 0})
                    </div>
                    {showInvoiced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  
                  {showInvoiced && (
                    <div className="grid gap-4 md:grid-cols-2 mt-4 animate-fade-in opacity-75">
                      {billingStatus
                        ?.filter(client => client.status === 'חויב במלואו' || client.status === 'הופקה חשבונית')
                        .map(client => (
                          <div key={client.client_id} className="border p-4 rounded-xl shadow-sm border-gray-200 bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                              <span className="font-bold text-lg text-gray-700">{client.client_name}</span>
                              <span className="font-bold px-3 py-1 rounded-full text-xs shadow-sm text-blue-700 bg-blue-100 border border-blue-200">
                                חויב במלואו
                              </span>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between text-gray-500">
                                <span>סה"כ טיולים החודש:</span>
                                <span className="font-bold">{client.total_trips}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>הוצאה חשבונית:</span>
                                <span className="font-bold text-blue-600">{client.invoiced_trips}</span>
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
