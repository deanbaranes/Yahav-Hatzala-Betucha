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
      <p className="text-gray-600 mb-4">{new Date(trip.start_date).toLocaleString('he-IL')}</p>
      
      {isUrgent && (
        <button 
          onClick={() => confirmMutation.mutate(trip.assignment_id)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-colors"
          disabled={confirmMutation.isPending}
        >
          {confirmMutation.isPending ? 'מאשר...' : 'אשר הגעה'}
        </button>
      )}
    </div>
  );
}
