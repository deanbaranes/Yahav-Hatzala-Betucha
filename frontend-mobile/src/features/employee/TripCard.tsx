import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

export default function TripCard({ trip }: { trip: any }) {
  const queryClient = useQueryClient();
  const isFull = trip.assigned_count >= trip.capacity;

  const joinMutation = useMutation({
    mutationFn: (role: string) => axiosClient.post(`/trips/${trip.id}/join`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-trips'] });
      queryClient.invalidateQueries({ queryKey: ['nextTrip'] });
    },
    onError: (err: any) => {
      alert('שגיאה: ' + (err.response?.data?.detail || 'לא ניתן להשתבץ לטיול זה.'));
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => axiosClient.post(`/trips/${trip.id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-trips'] });
      queryClient.invalidateQueries({ queryKey: ['nextTrip'] });
      if (confirm('ביטול הרישום בוצע בהצלחה.')) {}
    }
  });

  const rolesReqs = trip.roles_requirements || {};
  const roleCounts = trip.role_counts || {};
  const hasRoles = Object.keys(rolesReqs).length > 0;

  return (
    <div className={`bg-white rounded-xl shadow p-5 mb-4 text-right border-r-4 ${isFull ? 'border-orange-500 bg-orange-50/50' : 'border-blue-500'}`} dir="rtl">
      <h3 className="text-xl font-bold mb-2">{trip.location}</h3>
      <div className="text-gray-600 mb-2">
        <div>{new Date(trip.start_date).toLocaleDateString('he-IL')}</div>
        <div dir="ltr" style={{ textAlign: 'right' }}>
          {new Date(trip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
          {trip.end_date ? ` - ${new Date(trip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}` : ''}
        </div>
      </div>
      {!hasRoles && (
        <p className="text-md text-gray-500 mb-4">תפוסה כוללת: <span className="font-semibold">{trip.assigned_count} / {trip.capacity}</span></p>
      )}
      
      {trip.user_status ? (
        <div className="flex flex-col gap-2">
          <div className={`w-full py-4 rounded-xl font-bold text-lg text-center ${trip.user_status === 'waitlisted' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-200' : trip.user_is_confirmed ? 'bg-blue-100 text-blue-800 border-2 border-blue-200' : 'bg-purple-100 text-purple-800 border-2 border-purple-200'}`}>
            {trip.user_status === 'waitlisted' 
              ? 'הינך ברשימת המתנה לטיול זה ⏳' 
              : trip.user_is_confirmed 
                ? 'שיבוצך לטיול זה אושר ✓' 
                : 'נשלחה בקשה לשיבוץ, ממתין לאישור מנהל ⏳'}
          </div>
          <button 
            onClick={() => {
              if (window.confirm('האם אתה בטוח שברצונך לבטל את השתתפותך בטיול זה?')) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
            className="w-full py-2 rounded-lg font-bold text-sm text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
          >
            {cancelMutation.isPending ? 'מבטל...' : 'בטל רישום לטיול'}
          </button>
        </div>
      ) : hasRoles ? (
        <div className="space-y-3">
          <h4 className="font-bold text-gray-700 text-sm">בחר תפקיד להשתבץ:</h4>
          {Object.entries(rolesReqs).map(([role, maxCap]) => {
            const currentCap = roleCounts[role] || 0;
            const roleIsFull = currentCap >= (maxCap as number) || isFull;
            
            return (
              <div key={role} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <span className="font-bold block">{role}</span>
                  <span className="text-xs text-gray-500">{currentCap} / {maxCap as number} מאויש</span>
                </div>
                <button 
                  onClick={() => joinMutation.mutate(role)}
                  disabled={joinMutation.isPending}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${roleIsFull ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'}`}
                >
                  {joinMutation.isPending ? 'טוען...' : (roleIsFull ? 'המתנה' : 'שבץ אותי')}
                </button>
              </div>
            );
          })}
        </div>
      ) : trip.capacity === 0 ? (
        <div className="w-full py-4 rounded-xl font-bold text-lg text-center bg-gray-100 text-gray-500 border border-gray-200">
          טיול זה טרם הוגדר עם תפקידים
        </div>
      ) : (
        <button 
          onClick={() => joinMutation.mutate('general')}
          disabled={joinMutation.isPending}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${isFull ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}
        >
          {joinMutation.isPending ? 'טוען...' : (isFull ? 'היכנס לרשימת המתנה' : 'שבץ אותי')}
        </button>
      )}
    </div>
  );
}
