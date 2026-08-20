import React, { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, ArrowDownToLine, X, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function GoogleCalendarImport() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!icalUrl.trim()) {
      setError('אנא הדבק את הקישור הסודי מיומן גוגל');
      return;
    }
    if (!icalUrl.includes('calendar.google.com') && !icalUrl.includes('.ics')) {
      setError('הקישור לא נראה תקין. צפוי קישור מסוג calendar.google.com או .ics');
      return;
    }

    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await axiosClient.post('/trips/import-ical', {
        ical_url: icalUrl.trim()
      });
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['dashboard-trips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trips'] });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'שגיאה בלתי צפויה. בדוק את הקישור ונסה שנית.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setError('');
    setIcalUrl('');
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 w-full sm:w-auto"
      >
        <ArrowDownToLine size={18} />
        ייבוא מיומן גוגל
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={handleClose}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg text-right" dir="rtl" onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Calendar className="text-white" size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">ייבוא מיומן גוגל</h2>
                    <p className="text-blue-100 text-sm">סנכרן את האירועים שלך למערכת</p>
                  </div>
                </div>
                <button onClick={handleClose} className="text-white/70 hover:text-white p-1 transition-colors">
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">

              {/* Instructions */}
              {!result && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="font-bold text-blue-800 text-sm mb-3 flex items-center gap-2">
                    📋 איך מוצאים את הקישור הסודי?
                  </p>
                  <ol className="text-blue-700 text-sm space-y-2 list-decimal list-inside" dir="rtl">
                    <li>פתח את <strong>calendar.google.com</strong></li>
                    <li>לחץ על ⚙️ הגדרות (פינה ימנית עליונה)</li>
                    <li>בתפריט השמאלי, בחר את שם הלוח שנה שלך</li>
                    <li>גלול למטה לחלק <strong>"שלב את הלוח שנה הזה"</strong></li>
                    <li>לחץ על <strong>"כתובת סודית בפורמט iCal"</strong></li>
                    <li>העתק את הקישור והדבק כאן</li>
                  </ol>
                  <a
                    href="https://calendar.google.com/calendar/r/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-sm transition-colors"
                  >
                    <ExternalLink size={14} />
                    פתח הגדרות יומן גוגל
                  </a>
                </div>
              )}

              {/* Success Result */}
              {result && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle2 className="text-green-600 mt-0.5 flex-shrink-0" size={22} />
                    <div>
                      <p className="font-bold text-green-800 text-lg">הייבוא הסתיים בהצלחה!</p>
                      <div className="mt-2 space-y-1 text-sm text-green-700">
                        <p>✅ <strong>{result.created}</strong> טיולים חדשים נוצרו במערכת</p>
                        <p>⏭️ <strong>{result.skipped}</strong> אירועים דולגו (כפולים או ישנים)</p>
                      </div>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="font-bold text-amber-800 text-sm mb-1">⚠️ כמה אירועים לא עובדו:</p>
                      {result.errors.map((e, i) => <p key={i} className="text-amber-700 text-xs">{e}</p>)}
                    </div>
                  )}
                  <p className="text-gray-500 text-sm text-center">הטיולים יופיעו עכשיו בלוח השנה. שים לב שיש לעדכן לכל טיול את דרישות הצוות.</p>
                </div>
              )}

              {/* Input */}
              {!result && (
                <div>
                  <label className="block text-gray-700 font-bold mb-2 text-sm">
                    🔗 הדבק כאן את הקישור הסודי (iCal) מיומן גוגל:
                  </label>
                  <textarea
                    value={icalUrl}
                    onChange={e => { setIcalUrl(e.target.value); setError(''); }}
                    placeholder="https://calendar.google.com/calendar/ical/..."
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    rows={3}
                    dir="ltr"
                  />
                  {error && (
                    <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle size={15} />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={handleClose} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                {result ? 'סגור' : 'ביטול'}
              </button>
              {!result && (
                <button
                  onClick={handleImport}
                  disabled={loading || !icalUrl.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> מייבא...</>
                  ) : (
                    <><ArrowDownToLine size={18} /> ייבא טיולים</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
