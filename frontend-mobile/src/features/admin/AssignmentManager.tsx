import React from 'react';

export default function AssignmentManager({ assignments, capacity }: { assignments: any[], capacity: number }) {
  const confirmedCount = assignments?.filter(a => a.is_confirmed).length || 0;
  const isMissingStaff = confirmedCount < capacity;

  return (
    <div className="mt-4 border-t border-gray-200 pt-4 text-right" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">ניהול שיבוצים</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${isMissingStaff ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'}`}>
          {isMissingStaff ? `חסרים ${capacity - confirmedCount} אנשי צוות` : 'צוות מלא'}
        </div>
      </div>
      
      <ul className="space-y-2">
        {assignments?.map((a: any) => (
          <li key={a.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div>
              <span className="font-semibold block">{a.user?.full_name || 'עובד'}</span>
              {a.role && a.role !== 'general' && <span className="text-xs text-gray-500 font-bold">{a.role}</span>}
            </div>
            <span className={`px-3 py-1 rounded-full text-white text-sm font-semibold shadow-sm ${a.is_confirmed ? 'bg-green-500' : 'bg-yellow-500'}`}>
              {a.is_confirmed ? 'מאושר' : 'ממתין לאישור'}
            </span>
          </li>
        ))}
        {(!assignments || assignments.length === 0) && (
          <li className="text-gray-500 italic p-2">אין משובצים עדיין.</li>
        )}
      </ul>
    </div>
  );
}
