import React from 'react';
import TripManagementBoard from '../../features/admin/TripManagementBoard';

export default function Trips() {
  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">ניהול טיולים אופרטיבי</h1>
        <p className="text-gray-500 text-lg mt-2">צור טיולים חדשים, שייך לקוחות ונהל את כוח האדם.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
        <TripManagementBoard />
      </div>
    </div>
  );
}
