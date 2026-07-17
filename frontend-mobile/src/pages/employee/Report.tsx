import React from 'react';
import ReportForm from '../../features/employee/ReportForm';

export default function Report() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="mb-4 px-2">
        <h2 className="text-2xl font-black text-gray-900">הגשת דו"ח</h2>
        <p className="text-gray-500">דווח שעות והעלה קבלות הוצאות</p>
      </div>
      
      <ReportForm />
    </div>
  );
}
