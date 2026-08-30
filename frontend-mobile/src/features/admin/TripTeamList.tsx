import { CheckCircle2 } from 'lucide-react';

interface TripTeamListProps {
  trip: any;
  setReportingAssignment: (assignment: any) => void;
  removeAssignmentMutation: any;
}

export default function TripTeamList({ trip, setReportingAssignment, removeAssignmentMutation }: TripTeamListProps) {
  return (
    <>
      <div className="text-sm text-gray-500 font-bold mb-2">
        צוות מאושר בטיול ({trip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length || 0} מתוך {trip.capacity})
        {trip.roles_requirements && Object.keys(trip.roles_requirements).length > 0 ? (
          <span className="block text-xs text-blue-600 mt-1.5 font-medium bg-blue-50 p-1.5 rounded-md border border-blue-100 w-fit">
            סוגי עובדים נדרשים: {Object.entries(trip.roles_requirements).map(([role, count]) => `${count} ${role}`).join(', ')}
          </span>
        ) : (
          <span className="block text-xs text-blue-600 mt-1.5 font-medium bg-blue-50 p-1.5 rounded-md border border-blue-100 w-fit">
            סוגי עובדים נדרשים: {trip.capacity} כללי
          </span>
        )}
      </div>
      <div className="space-y-2">
        {trip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').length === 0 ? (
          <div className="text-sm text-red-500 font-medium">עדיין לא שובצו עובדים!</div>
        ) : (
          trip.assignments?.filter((a:any) => a.is_confirmed && a.status === 'assigned').map((a:any) => (
            <div key={a.id} className="flex justify-between items-center text-sm bg-white p-2 border border-gray-100 rounded shadow-sm">
              <span className="font-bold text-gray-800 flex items-center gap-1.5">
                {a.employee_confirmed_arrival ? (
                  <span title="אישר הגעה סופית" className="flex items-center"><CheckCircle2 size={14} className="text-green-500" /></span>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-300" title="טרם אישר הגעה סופית"></div>
                )}
                {a.user?.full_name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium text-xs bg-gray-100 px-2 py-0.5 rounded">{a.role || 'כללי'}</span>
                <button
                  onClick={() => setReportingAssignment(a)}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-xs font-bold transition-colors"
                >
                  דו״ח
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`האם אתה בטוח שברצונך למחוק את ${a.user?.full_name} מהטיול?`)) {
                      removeAssignmentMutation.mutate({ trip_id: trip.id, user_id: a.user_id });
                    }
                  }}
                  className="text-red-400 hover:text-red-600 p-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                  title="הסר עובד מהטיול"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
