import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';
import TripCard from './TripCard';

export default function TripFeed() {
  const { data: trips, isLoading } = useQuery<any>({
    queryKey: ['available-trips'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/available');
      return res.data;
    }
  });

  if (isLoading) return <div className="animate-pulse bg-gray-200 h-64 rounded-xl"></div>;

  return (
    <div className="text-right" dir="rtl">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">לוח טיולים</h2>
      {trips?.length === 0 && <p className="text-gray-500">אין טיולים זמינים כרגע.</p>}
      {trips?.map((trip: any) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
