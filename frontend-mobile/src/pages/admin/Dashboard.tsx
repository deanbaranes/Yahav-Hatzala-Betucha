import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import StaffApprovalsTable from '../../features/admin/StaffApprovalsTable';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';

export default function Dashboard() {
  const { data: trips, isLoading } = useQuery<any[]>({
    queryKey: ['dashboard-trips'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/');
      return res.data;
    }
  });

  // Group trips by date
  const tripsByDate = trips?.reduce((acc: any, trip: any) => {
    const dateStr = new Date(trip.start_date).toLocaleDateString('he-IL');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(trip);
    return acc;
  }, {});

  const queryClient = useQueryClient();

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => axiosClient.delete(`/trips/assignments/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      queryClient.invalidateQueries({ queryKey: ['unconfirmed-assignments'] });
      if(confirm('העובד הוסר מהטיול בהצלחה.')) {}
    }
  });

  return (
    <div className="space-y-8 animate-fade-in pb-10" dir="rtl">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">סקירה כללית</h1>
        <p className="text-gray-500 text-lg">מעקב יומי אחרי הטיולים והשיבוצים הקרובים.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Right side: Trips grouped by date */}
        <div className="xl:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Calendar className="text-blue-600" /> טיולים לפי תאריכים
            </h2>
            
            {isLoading ? (
              <div className="text-center p-8 text-gray-500">טוען נתונים...</div>
            ) : trips?.length === 0 ? (
              <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-xl">אין טיולים במערכת.</div>
            ) : (
              <div className="space-y-8">
                {Object.keys(tripsByDate || {}).map((dateStr) => (
                  <div key={dateStr} className="relative pl-4">
                    <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 py-2 border-b-2 border-blue-100 mb-4 inline-block">
                      <h3 className="font-bold text-lg text-blue-800">{dateStr}</h3>
                    </div>
                    
                    <div className="space-y-3">
                      {tripsByDate[dateStr].map((trip: any) => {
                        const confirmedCount = trip.assignments?.filter((a:any) => a.is_confirmed).length || 0;
                        const isFullyStaffed = confirmedCount >= trip.capacity;
                        
                        return (
                          <div 
                            key={trip.id} 
                            className={`p-4 rounded-xl border-2 transition-all ${
                              isFullyStaffed 
                                ? 'bg-blue-50 border-blue-200' 
                                : 'bg-green-50 border-green-200 shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className={`font-bold text-lg ${isFullyStaffed ? 'text-blue-900' : 'text-green-900'}`}>
                                  {trip.client?.name || 'לקוח לא ידוע'}
                                </h4>
                                <p className="text-gray-600 font-medium">{trip.location}</p>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2">
                                {trip.capacity === 0 ? (
                                  <span className="flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-300">
                                    ⚠️ חסרה הגדרת תפקידים (ערוך טיול)
                                  </span>
                                ) : (
                                  <span className={`flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${
                                    isFullyStaffed 
                                      ? 'bg-blue-200 text-blue-800' 
                                      : 'bg-green-200 text-green-800'
                                  }`}>
                                    {isFullyStaffed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                    {isFullyStaffed ? 'שובץ במלואו' : `חסרים ${trip.capacity - confirmedCount} אנשי צוות`}
                                  </span>
                                )}
                                <span className="text-sm text-gray-500 font-medium bg-white px-2 py-1 rounded-md shadow-sm">
                                  {new Date(trip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            </div>
                            {confirmedCount > 0 && (
                              <div className="mt-4 pt-3 border-t border-gray-200/60">
                                <h5 className="text-sm font-bold text-gray-700 mb-2">צוות מאושר לטיול:</h5>
                                <div className="flex flex-wrap gap-2">
                                  {trip.assignments?.filter((a:any) => a.is_confirmed).map((a:any) => (
                                    <span key={a.id} className="inline-flex items-center gap-1 bg-white border border-gray-200 px-3 py-1 rounded-full text-xs font-semibold shadow-sm text-gray-800">
                                      {a.user?.full_name || 'עובד'}
                                      <span className="text-gray-400 font-normal mr-1">| {a.role === 'general' || !a.role ? 'כללי' : a.role}</span>
                                      <button 
                                        onClick={() => {
                                          if (window.confirm('האם אתה בטוח שברצונך להסיר את העובד מטיול זה?')) {
                                            deleteAssignmentMutation.mutate(a.id);
                                          }
                                        }}
                                        className="mr-2 text-red-400 hover:text-red-600 transition-colors"
                                        title="הסר עובד מטיול"
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Left side: Pending Approvals */}
        <div className="xl:col-span-1 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="bg-indigo-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">אישור עובדים ממתינים</h2>
             </div>
             <div className="p-6">
                <StaffApprovalsTable />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
