import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

export default function StaffApprovalsTable() {
  const queryClient = useQueryClient();
  
  const { data: assignments, isLoading } = useQuery<any>({
    queryKey: ['unconfirmed-assignments'],
    queryFn: async () => {
      const res = await axiosClient.get('/trips/assignments/unconfirmed');
      return res.data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => axiosClient.patch(`/trips/assignments/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unconfirmed-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
    }
  });

  if (isLoading) return <div className="text-right p-4" dir="rtl">טוען נתונים...</div>;

  return (
    <div className="bg-white rounded-lg text-right" dir="rtl">
      
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
              <th className="p-2 md:p-4 text-xs md:text-base font-bold rounded-tr-lg">שם עובד</th>
              <th className="p-2 md:p-4 text-xs md:text-base font-bold">תפקיד</th>
              <th className="p-2 md:p-4 text-xs md:text-base font-bold">פרטי טיול</th>
              <th className="p-2 md:p-4 text-xs md:text-base font-bold rounded-tl-lg w-auto md:w-32">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {(!assignments || assignments.length === 0) && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500 italic">אין שיבוצים הממתינים לאישור מערכת.</td>
              </tr>
            )}
            {assignments?.map((a: any) => (
              <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="p-2 md:p-4">
                  <div className="font-medium text-gray-900 text-xs md:text-base">{a.full_name}</div>
                  <div className="text-[10px] md:text-sm text-gray-500">{a.phone}</div>
                </td>
                <td className="p-2 md:p-4 text-gray-800 font-semibold text-xs md:text-base">
                  <div>{a.role === 'general' || !a.role ? 'כללי' : a.role}</div>
                  {a.status === 'waitlisted' && <div className="text-[10px] md:text-xs text-orange-600 bg-orange-100 rounded-full px-1 md:px-2 py-0.5 inline-block mt-1 whitespace-nowrap">רשימת המתנה</div>}
                </td>
                <td className="p-2 md:p-4">
                  <div className="text-gray-900 text-xs md:text-base truncate max-w-[80px] md:max-w-[150px]" title={a.trip_location}>{a.trip_location}</div>
                  <div className="text-[10px] md:text-sm text-gray-500 whitespace-nowrap">{new Date(a.trip_start).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </td>
                <td className="p-2 md:p-4">
                  <button 
                    onClick={() => approveMutation.mutate(a.id)}
                    disabled={approveMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-bold shadow-sm transition-colors text-[11px] md:text-sm whitespace-nowrap"
                  >
                    אשר שיבוץ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
