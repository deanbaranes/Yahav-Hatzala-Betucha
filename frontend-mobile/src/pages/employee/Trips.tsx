import React from 'react';
import TripFeed from '../../features/employee/TripFeed';

export default function Trips() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-black text-gray-900">לוח שיבוצים פתוח</h2>
        <p className="text-gray-500">הירשם לטיולים פנויים והשתבץ</p>
      </div>
      
      <TripFeed />
    </div>
  );
}
