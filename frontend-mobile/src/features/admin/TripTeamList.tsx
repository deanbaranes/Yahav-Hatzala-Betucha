import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

interface TripTeamListProps {
  trip: any;
  setReportingAssignment: (assignment: any) => void;
  removeAssignmentMutation: any;
}

export default function TripTeamList({ trip, setReportingAssignment, removeAssignmentMutation }: TripTeamListProps) {
  const queryClient = useQueryClient();
  const [salaries, setSalaries] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const updateSalaryMutation = useMutation({
    mutationFn: ({ assignmentId, salary }: { assignmentId: string, salary: number | null }) => 
      axiosClient.patch(`/trips/assignments/${assignmentId}/promised-salary`, { promised_salary: salary }),
    onMutate: (vars) => {
      setSavingId(vars.assignmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      alert('השכר המובטח נשמר בהצלחה.');
    },
    onSettled: () => {
      setSavingId(null);
    }
  });

  const handleSaveSalary = (assignment: any) => {
    const value = salaries[assignment.id];
    if (value === undefined) return; // Unchanged
    const numValue = value === '' ? null : parseFloat(value);
    updateSalaryMutation.mutate({ assignmentId: assignment.id, salary: numValue });
  };

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
            <div key={a.id} className="flex justify-between items-center text-sm bg-white p-2 border border-gray-100 rounded shadow-sm flex-wrap gap-2">
              <span className="font-bold text-gray-800 flex items-center gap-1.5">
                {a.employee_confirmed_arrival ? (
                  <span title="אישר הגעה סופית" className="flex items-center"><CheckCircle2 size={14} className="text-green-500" /></span>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-300" title="טרם אישר הגעה סופית"></div>
                )}
                {a.user?.full_name}
              </span>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="flex items-center border border-gray-200 rounded px-2 bg-gray-50">
                    <span className="text-gray-400 text-xs pl-1">₪</span>
                    <input
                      type="number"
                      placeholder="שכר"
                      className="w-14 bg-transparent text-xs py-1 text-center font-bold text-blue-600 focus:outline-none"
                      value={salaries[a.id] !== undefined ? salaries[a.id] : (a.promised_salary || '')}
                      onChange={(e) => setSalaries({ ...salaries, [a.id]: e.target.value })}
                    />
                  </div>
                  {salaries[a.id] !== undefined && salaries[a.id] !== (a.promised_salary?.toString() || '') && (
                    <button
                      onClick={() => handleSaveSalary(a)}
                      disabled={savingId === a.id}
                      className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs font-bold transition-colors border border-green-200"
                    >
                      {savingId === a.id ? '...' : 'שמור'}
                    </button>
                  )}
                </div>
                
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
