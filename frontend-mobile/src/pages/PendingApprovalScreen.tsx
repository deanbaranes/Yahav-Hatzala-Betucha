export default function PendingApprovalScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-yellow-600 mb-4">ממתין לאישור</h1>
        <p className="text-gray-600">החשבון שלך ממתין לאישור מנהל. אנא המתן.</p>
      </div>
    </div>
  );
}
