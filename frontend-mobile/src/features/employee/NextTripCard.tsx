import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

export default function NextTripCard() {
  const queryClient = useQueryClient();
  const { data: trip, isLoading } = useQuery<any>({
    queryKey: ['nextTrip'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/next');
      return res.data;
    }
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => axiosClient.patch(`/trips/assignments/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nextTrip'] })
  });

  const cancelMutation = useMutation({
    mutationFn: () => axiosClient.post(`/trips/${trip.id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nextTrip'] });
      queryClient.invalidateQueries({ queryKey: ['available-trips'] });
      if (confirm('ביטול הרישום בוצע בהצלחה והודעה נשלחה למנהל.')) {}
    }
  });

  if (isLoading) return <div className="animate-pulse bg-gray-200 h-32 rounded-xl mb-4"></div>;
  if (!trip) return <div className="p-4 bg-white rounded-xl shadow mb-4 text-right" dir="rtl">אין טיולים קרובים</div>;

  const hoursDiff = (new Date(trip.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60);
  const isUrgent = hoursDiff < 24 && !trip.is_confirmed;

  return (
    <div className="bg-white rounded-xl shadow p-5 mb-4 text-right" dir="rtl">
      {isUrgent && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg font-bold mb-4 text-center text-lg border border-red-300">
          פעולה נדרשת: אשר הגעה לטיול של מחר
        </div>
      )}
      <h3 className="text-xl font-bold mb-2">{trip.location}</h3>
      <div className="text-gray-600 mb-4">
        <div>{new Date(trip.start_date).toLocaleDateString('he-IL')}</div>
        <div dir="ltr" style={{ textAlign: 'right' }}>
          {new Date(trip.start_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
          {trip.end_date ? ` - ${new Date(trip.end_date).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}` : ''}
        </div>
      </div>
      
      <div className="flex flex-col gap-3 mt-4">
        {isUrgent && (
          <button 
            onClick={() => confirmMutation.mutate(trip.assignment_id)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-colors"
            disabled={confirmMutation.isPending}
          >
            {confirmMutation.isPending ? 'מאשר...' : 'אשר הגעה'}
          </button>
        )}
        <button 
          onClick={() => {
            if (window.confirm('האם אתה בטוח שברצונך לבטל את השתתפותך בטיול זה? מנהל המערכת יעודכן.')) {
              cancelMutation.mutate();
            }
          }}
          className="w-full py-3 rounded-lg font-bold text-sm text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
          disabled={cancelMutation.isPending}
        >
          {cancelMutation.isPending ? 'מבטל...' : 'בטל רישום לטיול'}
        </button>
      </div>
    </div>
  );
}
