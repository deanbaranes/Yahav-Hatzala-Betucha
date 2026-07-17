import React from 'react';
import BillingPivotView from '../../features/admin/BillingPivotView';

export default function Billing() {
  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">הנהלת חשבונות ושכר</h1>
        <p className="text-gray-500 text-lg mt-2">מעקב אחר רווחיות, שעות נוספות והוצאות ללקוחות ועובדים.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
        <BillingPivotView />
      </div>
    </div>
  );
}
