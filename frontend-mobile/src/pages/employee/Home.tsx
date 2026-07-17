import React from 'react';
import NextTripCard from '../../features/employee/NextTripCard';

export default function Home() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-3xl shadow-lg mb-6">
        <h2 className="text-2xl font-black mb-1">שלום ישראל! 👋</h2>
        <p className="text-blue-100">מוכן ליום עבודה חדש?</p>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4 px-2">הטיול הבא שלי</h3>
        <NextTripCard />
      </div>
    </div>
  );
}
