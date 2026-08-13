import React from 'react';
import TripFeed from '../../features/employee/TripFeed';

export default function Trips() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-black text-gray-900">לוח שיבוצים פתוח</h2>
        <p className="text-gray-500 mb-3">הירשם לטיולים פנויים והשתבץ</p>
        
        <div className="flex gap-4 text-xs font-bold text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>פנוי לשיבוץ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>מלא (המתנה בלבד)</span>
          </div>
        </div>
      </div>
      
      <TripFeed />
    </div>
  );
}
