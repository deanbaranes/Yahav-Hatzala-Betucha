import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function MySchedule() {
  const { data: myTrips, isLoading } = useQuery<any[]>({
    queryKey: ['my-trips'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/my');
      return res.data;
    }
  });

  if (isLoading) return <div className="text-center p-8 text-blue-600 font-bold animate-pulse">טוען את הסידור שלך...</div>;

  const queryClient = useQueryClient();

  const confirmArrivalMutation = useMutation({
    mutationFn: (assignmentId: string) => axiosClient.patch(`/trips/assignments/${assignmentId}/confirm-arrival`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trips'] });
      alert("תודה! אישור ההגעה שלך נקלט בהצלחה.");
    }
  });

  const now = new Date();
  const assignedTrips = myTrips?.filter(t => t.status === 'assigned') || [];
  const waitlistedTrips = myTrips?.filter(t => t.status === 'waitlisted') || [];

  const upcomingTrips = assignedTrips.filter(t => {
    const tripDate = new Date(t.end_date || t.start_date);
    // Include trips happening today or in the future (subtracting 1 day to be safe with timezones)
    return tripDate.getTime() >= now.getTime() - 24 * 60 * 60 * 1000;
  });

  const pastTrips = assignedTrips.filter(t => {
    const tripDate = new Date(t.end_date || t.start_date);
    return tripDate.getTime() < now.getTime() - 24 * 60 * 60 * 1000;
  });

  return (
    <div className="animate-fade-in pb-10 space-y-6">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white p-6 rounded-3xl shadow-lg">
        <h2 className="text-2xl font-black mb-1 flex items-center gap-2"><Calendar size={24} /> הסידור שלי</h2>
        <p className="text-blue-100 font-medium">הטיולים שאתה משובץ אליהם.</p>
      </header>

      {assignedTrips.length === 0 && waitlistedTrips.length === 0 && (
        <div className="bg-white p-8 rounded-2xl text-center shadow-sm border border-gray-100">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Calendar size={32} />
          </div>
          <p className="font-bold text-gray-600">אין לך משמרות משובצות כרגע.</p>
          <a href="/employee/trips" className="text-blue-600 font-bold mt-2 inline-block hover:underline">חפש טיולים פנויים להרשמה</a>
        </div>
      )}

      {upcomingTrips.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-gray-800 px-2 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" /> משובץ לטיולים אלו:
          </h3>
          <div className="grid gap-4">
            {upcomingTrips.map(trip => (
              <div key={trip.id} className="bg-white p-5 rounded-2xl shadow-sm border-r-4 border-r-green-500 border border-gray-100 relative overflow-hidden">
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <h4 className="font-black text-gray-800 text-lg">{trip.client?.name || 'לקוח כללי'}</h4>
                  {trip.is_confirmed ? (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">אושר סופית</span>
                  ) : (
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">ממתין לאישור מנהל</span>
                  )}
                </div>
                <div className="space-y-2 text-sm text-gray-600 font-medium relative z-10">
                  <div className="flex items-center gap-2"><MapPin size={16} className="text-blue-500" /> {trip.location}</div>
                  <div className="flex items-center gap-2"><Clock size={16} className="text-blue-500" /> {new Date(trip.start_date).toLocaleString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })}</div>
                  <div className="flex items-center gap-2"><span className="text-blue-500 text-lg leading-none">👤</span> תפקיד: {trip.role || 'כללי'}</div>
                </div>
                {trip.is_confirmed && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end relative z-10">
                    {trip.employee_confirmed_arrival ? (
                      <span className="flex items-center gap-1.5 text-green-600 font-bold text-sm bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                        <CheckCircle2 size={16} /> אישרת הגעה
                      </span>
                    ) : (
                      <button 
                        onClick={() => confirmArrivalMutation.mutate(trip.assignment_id)}
                        disabled={confirmArrivalMutation.isPending}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 text-sm"
                      >
                        <CheckCircle size={16} /> לחץ לאישור הגעה לטיול
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pastTrips.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <details className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <summary className="flex justify-between items-center font-bold text-lg text-gray-700 p-5 cursor-pointer list-none">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-gray-400" /> 
                טיולים שהסתיימו ({pastTrips.length})
              </div>
              <span className="transition group-open:rotate-180">
                <svg fill="none" height="24" shape-rendering="geometricPrecision" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
              </span>
            </summary>
            <div className="p-5 pt-0 grid gap-4 bg-gray-50/50">
              {pastTrips.map(trip => (
                <div key={trip.id} className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-r-gray-400 border border-gray-100 opacity-80">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-700">{trip.client?.name || 'לקוח כללי'}</h4>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-2"><MapPin size={14} /> {trip.location}</div>
                    <div className="flex items-center gap-2"><Clock size={14} /> {new Date(trip.start_date).toLocaleString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {waitlistedTrips.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h3 className="font-bold text-lg text-gray-800 px-2 flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-500" /> רשימת המתנה (סטנדביי)
          </h3>
          <div className="grid gap-4 opacity-75">
            {waitlistedTrips.map(trip => (
              <div key={trip.id} className="bg-gray-50 p-5 rounded-2xl shadow-sm border-r-4 border-r-amber-400 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-2">{trip.location}</h4>
                <div className="text-xs text-gray-500 font-medium flex gap-4">
                  <span className="flex items-center gap-1"><Clock size={14}/> {new Date(trip.start_date).toLocaleDateString('he-IL')}</span>
                  <span>{trip.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
