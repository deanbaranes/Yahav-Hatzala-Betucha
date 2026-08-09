import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import SmartClientInput from './SmartClientInput';
import GoogleCalendarImport from './GoogleCalendarImport';

const AVAILABLE_ROLES = ["מע\"ר", "חובש", "פראמדיק", "שומר לילה", "מע\"ר חמוש", "חובש חמוש", "מאבטח"];

export default function TripManagementBoard() {
  const queryClient = useQueryClient();
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {} as Record<string, number>, color: '' as string, global_salary: '' as string | number, contact_phone: '' as string });
  const [searchTerm, setSearchTerm] = useState('');

  const totalCapacity = Object.values(formData.roles_requirements).reduce((a, b) => a + b, 0);

  const createTrip = useMutation({
    mutationFn: (data: any) => axiosClient.post('/trips/', { ...data, capacity: totalCapacity }), // Include capacity for backward compatibility
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      alert('הטיול נוצר בהצלחה!');
      setFormData({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {}, color: '', global_salary: '', contact_phone: '' });
    },
    onError: (error: any) => {
      alert('שגיאה ביצירת הטיול: ' + (error.response?.data?.detail || 'אנא ודא שכל השדות מלאים ותקינים.'));
    }
  });

  const updateTrip = useMutation({
    mutationFn: (data: any) => axiosClient.put(`/trips/${editingTripId}`, { ...data, capacity: totalCapacity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      alert('הטיול עודכן בהצלחה!');
      setEditingTripId(null);
      setFormData({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {}, color: '', global_salary: '', contact_phone: '' });
    },
    onError: (error: any) => {
      alert('שגיאה בעדכון הטיול: ' + (error.response?.data?.detail || 'אנא ודא שכל השדות מלאים ותקינים.'));
    }
  });

  const { data: trips, isLoading: isLoadingTrips } = useQuery<any[]>({
    queryKey: ['admin-trips'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/');
      return res.data;
    }
  });

  const deleteTrip = useMutation({
    mutationFn: (tripId: string) => axiosClient.delete(`/trips/${tripId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      if (confirm('הטיול נמחק בהצלחה.')) {}
    }
  });

  const updateRoleCount = (role: string, count: number) => {
    setFormData(prev => {
      const newRoles = { ...prev.roles_requirements };
      if (count <= 0) {
        delete newRoles[role];
      } else {
        newRoles[role] = count;
      }
      return { ...prev, roles_requirements: newRoles };
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8 text-right" dir="rtl">
      <div className="mb-6 flex justify-start">
        <GoogleCalendarImport />
      </div>

      <div className="flex flex-col gap-3 mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">{editingTripId ? 'עריכת טיול' : 'יצירת טיול חדש'}</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SmartClientInput value={formData.client_name} onChange={(v) => setFormData({...formData, client_name: v})} />
        
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">מיקום</label>
          <input type="text" placeholder="כתובת יעד" className="w-full p-2 border border-gray-300 rounded" 
            value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        </div>
          
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">שעת התחלה</label>
          <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded" 
            value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
        </div>
          
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">שעת סיום משוערת</label>
          <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded" 
            value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">שכר גלובלי לטיול (₪)</label>
          <input type="number" min="0" className="w-full p-2 border border-gray-300 rounded placeholder:text-sm" 
            placeholder="הזן סכום גלובלי (אופציונלי)"
            value={formData.global_salary} onChange={e => setFormData({...formData, global_salary: e.target.value})} />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">איש קשר (לא יוצג לעובדים טרם אישור)</label>
          <input type="text" className="w-full p-2 border border-gray-300 rounded placeholder:text-sm" 
            placeholder="לדוגמה: 050-1234567"
            value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} />
        </div>
          
        <div className="mb-4 md:col-span-2">
          <label className="block text-gray-700 font-bold mb-2">צבע הטיול ביומן</label>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { color: '', label: 'אוטומטי (לפי סטטוס)' },
              { color: '#039BE5', label: 'ציאן (Peacock)' },
              { color: '#D50000', label: 'אדום (Tomato)' },
              { color: '#0B8043', label: 'ירוק (Basil)' },
              { color: '#F4511E', label: 'כתום (Tangerine)' },
              { color: '#8E24AA', label: 'סגול (Grape)' },
              { color: '#F6BF26', label: 'צהוב (Banana)' },
              { color: '#3F51B5', label: 'כחול (Blueberry)' },
              { color: '#616161', label: 'אפור (Graphite)' },
            ].map(({ color, label }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={() => setFormData({ ...formData, color })}
                className={`w-8 h-8 rounded-full border-4 transition-all ${
                  formData.color === color
                    ? 'border-gray-800 scale-125'
                    : 'border-gray-200 hover:scale-110'
                }`}
                style={{ backgroundColor: color || '#e5e7eb' }}
              >
                {color === '' && <span className="text-gray-400 text-xs font-bold flex items-center justify-center w-full h-full">א</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 md:col-span-2">
          <label className="block text-gray-700 font-bold mb-4 border-b pb-2">דרישות צוות (סה"כ: {totalCapacity})</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {AVAILABLE_ROLES.map(role => (
              <div key={role} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="font-semibold text-gray-700">{role}</span>
                <input 
                  type="number" 
                  min="0" 
                  className="w-16 p-1 border border-gray-300 rounded text-center" 
                  value={formData.roles_requirements[role] || ''} 
                  placeholder="0"
                  onChange={e => updateRoleCount(role, parseInt(e.target.value) || 0)} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
        
      <div className="flex gap-4 mt-6">
        <button 
          onClick={() => editingTripId ? updateTrip.mutate(formData) : createTrip.mutate(formData)} 
          disabled={createTrip.isPending || updateTrip.isPending || !formData.client_name || !formData.start_date || !formData.location || (!editingTripId && totalCapacity === 0)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow transition-colors disabled:bg-gray-400"
          title={(!editingTripId && totalCapacity === 0) ? "חובה להגדיר לפחות תפקיד אחד לטיול" : ""}
        >
          {createTrip.isPending || updateTrip.isPending ? 'שומר...' : editingTripId ? 'שמור שינויים' : 'צור טיול'}
        </button>
        
        {editingTripId && (
          <button 
            onClick={() => {
              setEditingTripId(null);
              setFormData({ client_name: '', location: '', start_date: '', end_date: '', roles_requirements: {}, color: '', global_salary: '', contact_phone: '' });
            }}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold shadow transition-colors"
          >
            ביטול עריכה
          </button>
        )}
      </div>

      {/* Trips List */}
      <div className="mt-12 border-t pt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h3 className="text-xl font-bold text-gray-800">טיולים קיימים במערכת</h3>
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="חיפוש חברה או מיקום..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
            />
            <span className="absolute right-2.5 top-2.5 text-gray-400">🔍</span>
          </div>
        </div>

        {isLoadingTrips ? (
          <div className="text-gray-500">טוען טיולים...</div>
        ) : !trips || trips.length === 0 ? (
          <div className="text-gray-500">אין עדיין טיולים פעילים.</div>
        ) : (
          <div className="space-y-4">
            {trips.filter(t => (t.client?.name || '').includes(searchTerm) || (t.location || '').includes(searchTerm)).map((trip: any) => (
              <div key={trip.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-start gap-3">
                    <button 
                      onClick={() => {
                        setEditingTripId(trip.id);
                        setFormData({
                          client_name: trip.client?.name || '',
                          location: trip.location || '',
                          start_date: trip.start_date ? trip.start_date.substring(0, 16) : '',
                          end_date: trip.end_date ? trip.end_date.substring(0, 16) : '',
                          roles_requirements: trip.roles_requirements || {},
                          color: trip.color || '',
                          global_salary: trip.global_salary || '',
                          contact_phone: trip.contact_phone || ''
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-gray-400 hover:text-blue-600 p-1 transition-colors"
                      title="ערוך טיול"
                    >
                      ✎
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm('האם אתה בטוח שברצונך למחוק טיול זה לצמיתות?')) {
                          deleteTrip.mutate(trip.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-600 p-1 transition-colors"
                      title="מחק טיול"
                    >
                      ✕
                    </button>
                    <div>
                      <span className="font-bold text-lg text-blue-700">{trip.client?.name === 'לקוח כללי' ? trip.location : trip.client?.name}</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span className="text-gray-700">{trip.client?.name === 'לקוח כללי' ? 'מיובא מיומן גוגל' : trip.location}</span>
                    </div>
                  </div>
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
                    דרושים {trip.capacity} אנשי צוות
                  </span>
                </div>
                <div className="text-gray-500 text-sm mb-3">
                  זמן התחלה: {new Date(trip.start_date).toLocaleString('he-IL')}
                </div>
                
                {/* Confirmed Employees */}
                {trip.assignments?.filter((a:any) => a.is_confirmed).length > 0 && (
                  <div className="border-t border-gray-200/50 pt-2 mt-2">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">עובדים ששובצו:</span>
                    <div className="flex flex-wrap gap-1">
                      {trip.assignments.filter((a:any) => a.is_confirmed).map((a:any) => (
                        <span key={a.id} className="bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs shadow-sm font-medium">
                          {a.user?.full_name || 'עובד'} <span className="text-gray-400">({a.role === 'general' || !a.role ? 'כללי' : a.role})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
