import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import StaffApprovalsTable from '../../features/admin/StaffApprovalsTable';
import TripCalendar from '../../features/admin/TripCalendar';
import { Calendar as CalendarIcon, CheckCircle2, Clock, List, Map, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import TripDetailsModal from '../../features/admin/TripDetailsModal';
import CreateManualTripModal from '../../features/admin/CreateManualTripModal';

export default function Dashboard() {
  const { user } = useAuth();
  // זמנית: הוספנו גם את דין (0504851269) כדי שתוכל לראות את השינויים
  const isYahav = user?.name?.includes('יהב') || (user as any)?.full_name?.includes('יהב') || (user as any)?.phone === '0533210777' || user?.name?.includes('דין') || (user as any)?.full_name?.includes('דין') || (user as any)?.phone === '0504851269';

  const [viewMode, setViewMode] = React.useState<'calendar' | 'list'>('calendar');
  
  React.useEffect(() => {
    if (isYahav) {
      setViewMode('list');
    }
  }, [isYahav]);

  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  const [openModalInEditMode, setOpenModalInEditMode] = React.useState(false);
  const [creatingTripDate, setCreatingTripDate] = React.useState<Date | null>(null);
  const [listSearchTerm, setListSearchTerm] = React.useState('');
  const [showPastTrips, setShowPastTrips] = React.useState(false);

  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await axiosClient.get('/payroll/employees');
      return res.data;
    }
  });

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: billingStatus } = useQuery<any[]>({
    queryKey: ['billing-status', year, month],
    queryFn: async () => {
      const res = await axiosClient.get(`/trips/billing-status/${year}/${month}`);
      return res.data;
    }
  });

  const readyToBill = billingStatus?.filter(c => c.status === 'מוכן לחיוב') || [];


  const { data: trips, isLoading } = useQuery<any[]>({
    queryKey: ['dashboard-trips'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/');
      return res.data;
    }
  });

  // Group trips by date, sorting closest first and filtering out past days
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const sortedTrips = trips ? [...trips]
    .filter(t => showPastTrips || new Date(t.start_date) >= todayStart)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()) : [];
    
  const filteredSortedTrips = sortedTrips.filter(trip => {
    if (!listSearchTerm) return true;
    const term = listSearchTerm.toLowerCase();
    const nameMatch = (trip.client?.name || '').toLowerCase().includes(term);
    const locMatch = (trip.location || '').toLowerCase().includes(term);
    const notesMatch = (trip.notes || '').toLowerCase().includes(term);
    const employeeMatch = trip.assignments?.some((a: any) => 
      (a.user?.full_name || '').toLowerCase().includes(term)
    );
    return nameMatch || locMatch || notesMatch || employeeMatch;
  });
    
  const tripsByDate = filteredSortedTrips.reduce((acc: any, trip: any) => {
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

  const GreenBillingBar = () => (
    <div className="bg-green-50 border-2 border-green-400 text-green-900 px-6 py-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in text-center md:text-right">
      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
        <div className="bg-green-100 p-3 rounded-full shadow-inner hidden md:block">
          <span className="text-2xl">💰</span>
        </div>
        <div className="flex-1 flex flex-col items-center md:items-start w-full">
          <div className="flex items-center gap-2 mb-1 justify-center md:justify-start w-full">
            <span className="text-xl md:hidden">💰</span>
            <h3 className="font-black text-lg md:text-xl">ישנם לקוחות שמוכנים להוצאת חשבונית לחודש זה!</h3>
          </div>
          <p className="text-sm font-medium opacity-90 mt-1 text-center md:text-right max-w-lg mb-3 md:mb-0">
            {readyToBill.map(c => c.client_name).join(', ')} סיימו את כל הטיולים שלהם לחודש זה.
          </p>
          <a href="/admin/billing" className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm whitespace-nowrap mt-2 md:mt-0 md:hidden block w-full sm:w-auto text-center mx-auto">
            למעבר לדוח חיובים
          </a>
        </div>
      </div>
      <a href="/admin/billing" className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm whitespace-nowrap hidden md:block">
        למעבר לדוח חיובים
      </a>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10" dir="rtl">
      {isYahav ? (
        <header className="mb-4 flex justify-start gap-2 border-b pb-4">
          <button 
            onClick={() => setViewMode('list')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold border transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            <List size={16} className="inline ml-1" /> רשימה
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold border transition-colors ${viewMode === 'calendar' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            <CalendarIcon size={16} className="inline ml-1" /> יומן
          </button>
        </header>
      ) : (
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-l from-slate-900 to-slate-800 p-6 md:p-8 rounded-3xl shadow-lg text-white">
          <div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight mb-2 flex items-center gap-3 md:gap-4">
              <span className="bg-white/10 p-2 md:p-3 rounded-xl backdrop-blur-md">
                <Map className="text-blue-400 w-6 h-6 md:w-8 md:h-8" />
              </span>
              סקירה כללית
            </h1>
            <p className="text-slate-400 text-sm md:text-lg font-medium max-w-xl">מעקב יומי אחרי הטיולים, שיבוצים קרובים, וסטטוס אישורי צוות.</p>
          </div>
          <div className="flex flex-wrap bg-white/10 p-1.5 rounded-2xl backdrop-blur-md shadow-inner w-full md:w-auto">
            <button 
              onClick={() => setViewMode('calendar')}
              className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-sm md:text-base transition-all ${viewMode === 'calendar' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
            >
              <CalendarIcon size={18} /> תצוגת יומן
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-sm md:text-base transition-all ${viewMode === 'list' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
            >
              <List size={18} /> רשימה יומית
            </button>
          </div>
        </header>
      )}

      {!isYahav && readyToBill.length > 0 && <GreenBillingBar />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Right side: Trips */}
        <div className="xl:col-span-2 space-y-8">
          {viewMode === 'calendar' ? (
            <TripCalendar trips={trips || []} />
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <div className="flex flex-col mb-8 gap-4">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 whitespace-nowrap">
                  <span className="bg-blue-50 text-blue-600 p-2 rounded-lg"><List size={24} /></span>
                  טיולים לפי תאריכים
                </h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
                  {isYahav && (
                    <button 
                      onClick={() => setCreatingTripDate(new Date())}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors w-full sm:w-auto shrink-0"
                    >
                      <Plus size={18} />
                      הוסף טיול
                    </button>
                  )}
                  <div className="relative w-full sm:w-64">
                    <input 
                      type="text" 
                      placeholder="חיפוש חברה, מיקום או עובד..."
                      value={listSearchTerm}
                      onChange={(e) => setListSearchTerm(e.target.value)}
                      className="w-full p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                    />
                    <span className="absolute right-2.5 top-2 text-gray-400">🔍</span>
                  </div>
                </div>
              </div>
            
            {isLoading ? (
              <div className="text-center p-8 text-gray-500">טוען נתונים...</div>
            ) : trips?.length === 0 ? (
              <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-xl">אין טיולים במערכת.</div>
            ) : (
              <div className="space-y-8">
                <button 
                  onClick={() => setShowPastTrips(!showPastTrips)}
                  className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-3 rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock size={18} /> {showPastTrips ? 'הסתר טיולים מתאריכים שעברו' : 'הצג טיולים מתאריכים שעברו'}
                </button>
                
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
                            onClick={() => setSelectedTrip(trip)}
                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                              trip.is_billed
                                ? 'bg-red-50 border-red-200 hover:shadow-md'
                                : isFullyStaffed 
                                  ? 'bg-blue-50 border-blue-200 hover:shadow-md' 
                                  : 'bg-green-50 border-green-200 shadow-sm hover:shadow-md'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className={`font-bold text-lg ${trip.is_billed ? 'text-red-800' : isFullyStaffed ? 'text-blue-900' : 'text-green-900'}`}>
                                  {trip.client?.name === 'לקוח כללי' ? trip.location : (trip.client?.name || 'לקוח לא ידוע')}
                                </h4>
                                {trip.notes && (
                                  <div className="text-[13px] font-medium text-gray-600 mt-1">
                                    {trip.notes}
                                  </div>
                                )}
                                <p className="text-gray-500 text-sm mt-1">
                                  {trip.client?.name === 'לקוח כללי' ? 'מיובא מיומן גוגל' : trip.location}
                                </p>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2">
                                  {isYahav && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTrip(trip);
                                        setOpenModalInEditMode(true);
                                      }} 
                                      className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                      title="ערוך טיול"
                                    >
                                      <Pencil size={18} />
                                    </button>
                                  )}
                                  {!trip.is_billed && trip.capacity > 0 && (
                                    <span className={`flex items-center text-center gap-1 text-xs md:text-sm font-bold px-3 py-1.5 rounded-xl ${
                                      isFullyStaffed 
                                        ? 'bg-blue-200 text-blue-800' 
                                        : 'bg-green-200 text-green-800'
                                    }`}>
                                      {isFullyStaffed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                      {isFullyStaffed ? 'שובץ במלואו' : `חסרים ${trip.capacity - confirmedCount} אנשי צוות`}
                                    </span>
                                  )}
                                  {trip.is_billed && (
                                    <span className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-red-100 text-red-700">
                                      <CheckCircle2 size={16} /> חויב
                                    </span>
                                  )}
                                </div>
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
                                      {a.employee_confirmed_arrival ? (
                                        <span title="אישר הגעה סופית" className="mr-1 inline-flex items-center"><CheckCircle2 size={14} className="text-green-500" /></span>
                                      ) : (
                                        <span title="טרם אישר הגעה סופית" className="mr-1 inline-flex items-center"><div className="w-2 h-2 rounded-full bg-gray-300"></div></span>
                                      )}
                                      <span className="text-gray-400 font-normal mr-1">| {a.role === 'general' || !a.role ? 'כללי' : a.role}</span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
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
          )}
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
          {isYahav && readyToBill.length > 0 && <GreenBillingBar />}
        </div>
      </div>

      {selectedTrip && (
        <TripDetailsModal 
          selectedTrip={selectedTrip} 
          employees={employees || []} 
          onClose={() => {
            setSelectedTrip(null);
            setOpenModalInEditMode(false);
          }} 
          initialEditMode={openModalInEditMode}
        />
      )}

      {creatingTripDate && (
        <CreateManualTripModal 
          initialDate={creatingTripDate} 
          onClose={() => setCreatingTripDate(null)} 
        />
      )}
    </div>
  );
}
