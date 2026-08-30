

const AVAILABLE_ROLES = ["מע\"ר", "חובש", "פראמדיק", "שומר לילה", "מע\"ר חמוש", "חובש חמוש", "מאבטח", "מדריך"];

interface TripQuickEditFormProps {
  quickEditForm: any;
  setQuickEditForm: (val: any) => void;
  setQuickEditMode: (val: boolean) => void;
  updateTripMutation: any;
}

export default function TripQuickEditForm({ quickEditForm, setQuickEditForm, setQuickEditMode, updateTripMutation }: TripQuickEditFormProps) {
  return (
    <div className="space-y-4 mb-6 p-4 bg-blue-50/30 rounded-lg border border-blue-100">
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">הערה / טקסט חופשי (למשל: הדרכה)</label>
        <input type="text" placeholder="טקסט שיופיע ליד שם הלקוח" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.notes} onChange={e => setQuickEditForm({...quickEditForm, notes: e.target.value})} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">מיקום (אופציונלי)</label>
        <input type="text" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.location} onChange={e => setQuickEditForm({...quickEditForm, location: e.target.value})} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">שעת התחלה</label>
        <input type="datetime-local" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.start_date} onChange={e => setQuickEditForm({...quickEditForm, start_date: e.target.value})} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">שעת סיום</label>
        <input type="datetime-local" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.end_date} onChange={e => setQuickEditForm({...quickEditForm, end_date: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">שם איש קשר (פנימי)</label>
          <input type="text" placeholder="למשל: דוד" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.contact_name} onChange={e => setQuickEditForm({...quickEditForm, contact_name: e.target.value})} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">נייד איש קשר (פנימי)</label>
          <input type="text" placeholder="למשל: 050-1234567" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.contact_phone} onChange={e => setQuickEditForm({...quickEditForm, contact_phone: e.target.value})} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">שם איש קשר (לעובד)</label>
          <input type="text" placeholder="למשל: נציג שטח" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.employee_contact_name} onChange={e => setQuickEditForm({...quickEditForm, employee_contact_name: e.target.value})} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">נייד איש קשר (לעובד)</label>
          <input type="text" placeholder="למשל: 050-1234567" className="w-full p-2 text-sm border border-gray-300 rounded" value={quickEditForm.employee_contact_phone} onChange={e => setQuickEditForm({...quickEditForm, employee_contact_phone: e.target.value})} />
        </div>
      </div>
      <div className="mb-4 md:col-span-2">
        <label className="block text-xs font-bold text-gray-600 mb-2 border-b pb-1">
          דרישות צוות (סה"כ: {(Object.values(quickEditForm.roles_requirements || {}) as number[]).reduce((a, b) => a + b, 0)})
        </label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_ROLES.map(role => (
            <div key={role} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
              <span className="text-xs font-semibold text-gray-700">{role}</span>
              <input 
                type="number" 
                min="0" 
                className="w-12 p-1 border border-gray-300 rounded text-center text-xs" 
                value={quickEditForm.roles_requirements?.[role] || ''} 
                placeholder="0"
                onChange={e => {
                  const count = parseInt(e.target.value) || 0;
                  const newRoles = { ...(quickEditForm.roles_requirements || {}) };
                  if (count <= 0) {
                    delete newRoles[role];
                  } else {
                    newRoles[role] = count;
                  }
                  const newCapacity = (Object.values(newRoles) as number[]).reduce((a, b) => a + b, 0);
                  setQuickEditForm({...quickEditForm, roles_requirements: newRoles, capacity: newCapacity});
                }} 
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">שכר בסיס ל-9 שעות</label>
        <input 
          type="number" 
          min="0"
          className="w-full p-2 text-sm border border-gray-300 rounded" 
          value={quickEditForm.global_salary} 
          onChange={e => setQuickEditForm({...quickEditForm, global_salary: e.target.value})} 
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">צבע הטיול ביומן</label>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { color: '', label: 'אוטומטי (לפי סטטוס)' },
            { color: '#039BE5', label: 'ציאן' },
            { color: '#D50000', label: 'אדום' },
            { color: '#0B8043', label: 'ירוק' },
            { color: '#F4511E', label: 'כתום' },
            { color: '#8E24AA', label: 'סגול' },
            { color: '#F6BF26', label: 'צהוב' },
            { color: '#3F51B5', label: 'כחול' },
            { color: '#616161', label: 'אפור' },
          ].map(({ color, label }) => (
            <button
              key={label}
              type="button"
              title={label}
              onClick={() => setQuickEditForm({ ...quickEditForm, color })}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                quickEditForm.color === color
                  ? 'border-gray-900 scale-125'
                  : 'border-gray-200 hover:scale-110'
              }`}
              style={{ backgroundColor: color || '#e5e7eb' }}
            >
              {color === '' && <span className="text-gray-400 text-xs font-bold flex items-center justify-center w-full h-full">א</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-blue-100">
        <button onClick={() => setQuickEditMode(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded">ביטול</button>
        <button 
          disabled={updateTripMutation.isPending}
          onClick={() => updateTripMutation.mutate(quickEditForm)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded font-bold"
        >
          {updateTripMutation.isPending ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );
}
