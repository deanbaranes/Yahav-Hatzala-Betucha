import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../../api/axiosClient';

interface AssignEmployeeFormProps {
  tripId: string;
  employees: any[];
  onAssignSuccess: () => void;
}

export default function AssignEmployeeForm({ tripId, employees, onAssignSuccess }: AssignEmployeeFormProps) {
  const queryClient = useQueryClient();
  const [assignEmployeeName, setAssignEmployeeName] = useState('');
  const [assignEmployeeRole, setAssignEmployeeRole] = useState('כללי');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (assignEmployeeName && employees) {
      setFilteredEmployees(employees.filter(e => e.full_name.includes(assignEmployeeName)));
    } else {
      setFilteredEmployees([]);
    }
  }, [assignEmployeeName, employees]);

  const assignEmployeeMutation = useMutation({
    mutationFn: async (payload: { trip_id: string, user_id?: string, new_user_name?: string, role: string }) => {
      let finalUserId = payload.user_id;
      if (!finalUserId && payload.new_user_name) {
         const res = await axiosClient.post('/payroll/employees', {
           full_name: payload.new_user_name,
           phone: `050${Math.floor(1000000 + Math.random() * 9000000)}`,
           password: '123',
           notes: 'יש לעדכן לעובד שכר שעתי'
         });
         finalUserId = res.data.id;
         alert(`שים לב: הלקוח/עובד ${payload.new_user_name} לא היה קיים, לכן נוצר עובד חדש. יש לעדכן לו שכר שעתי!`);
      }

      await axiosClient.post(`/trips/${payload.trip_id}/assign`, {
        user_id: finalUserId,
        role: payload.role,
        status: 'assigned',
        is_confirmed: true
      });
    },
    onSuccess: () => {
      alert('עובד שובץ בהצלחה!');
      setAssignEmployeeName('');
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onAssignSuccess();
    },
    onError: (err: any) => {
      alert('שגיאה בשיבוץ העובד: ' + (err.response?.data?.detail || ''));
    }
  });

  return (
    <div className="mt-6 pt-4 border-t border-blue-200">
      <h4 className="text-sm font-bold text-blue-900 mb-2">➕ הוסף עובד לטיול זה</h4>
      <div className="relative mb-2">
        <input 
          type="text" 
          placeholder="התחל להקליד שם עובד..."
          className="w-full p-2 text-sm border border-gray-300 rounded"
          value={assignEmployeeName}
          onChange={(e) => {
            setAssignEmployeeName(e.target.value);
            setShowEmployeeDropdown(true);
          }}
          onFocus={() => setShowEmployeeDropdown(true)}
        />
        {showEmployeeDropdown && assignEmployeeName && (
          <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-md shadow-lg max-h-40 overflow-y-auto">
            {filteredEmployees.map(emp => (
              <div 
                key={emp.id} 
                className="p-2 text-sm hover:bg-blue-50 cursor-pointer"
                onClick={() => {
                  setAssignEmployeeName(emp.full_name);
                  setShowEmployeeDropdown(false);
                }}
              >
                {emp.full_name}
              </div>
            ))}
            {filteredEmployees.length === 0 && (
              <div className="p-2 text-sm text-gray-500 italic">
                לא נמצא עובד כזה. לחיצה על "שבץ עובד" תיצור עובד חדש.
              </div>
            )}
          </div>
        )}
      </div>
      <select
        className="w-full p-2 text-sm border border-gray-300 rounded mb-2 bg-white"
        value={assignEmployeeRole}
        onChange={e => setAssignEmployeeRole(e.target.value)}
      >
        <option value="כללי">כללי</option>
        <option value="חובש">חובש</option>
        <option value="מע״ר">מע״ר</option>
        <option value="מע״ר חמוש">מע״ר חמוש</option>
        <option value="פראמדיק">פראמדיק</option>
        <option value="רופא">רופא</option>
        <option value="מלווה נשק">מלווה נשק</option>
        <option value="שומר לילה">שומר לילה</option>
        <option value="נהג">נהג</option>
      </select>
      <button 
        disabled={!assignEmployeeName || assignEmployeeMutation.isPending}
        onClick={() => {
          const existing = employees?.find(e => e.full_name === assignEmployeeName);
          assignEmployeeMutation.mutate({
            trip_id: tripId,
            user_id: existing?.id,
            new_user_name: !existing ? assignEmployeeName : undefined,
            role: assignEmployeeRole
          });
        }}
        className="mt-2 w-full px-3 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded font-bold disabled:opacity-50"
      >
        {assignEmployeeMutation.isPending ? 'משבץ...' : 'שבץ עובד'}
      </button>
    </div>
  );
}
