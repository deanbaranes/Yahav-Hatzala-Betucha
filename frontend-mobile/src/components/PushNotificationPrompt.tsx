import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Bell, BellRing } from 'lucide-react';

export default function PushNotificationPrompt() {
  const [permission, setPermission] = useState(Notification.permission);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(true);

  const [vapidKey, setVapidKey] = useState<string | null>(null);

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then(status => {
        status.onchange = () => {
          setPermission(status.state === 'prompt' ? 'default' : (status.state as NotificationPermission));
        };
      });
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setIsSubscribed(!!subscription);
          if (!subscription) {
            // Fetch VAPID key in advance to avoid losing user gesture context
            axiosClient.get('/push/public-key').then(res => {
              if (res.data && res.data.public_key) {
                setVapidKey(res.data.public_key);
              }
            }).catch(err => console.error('Failed to pre-fetch VAPID key', err));
          }
        });
      });
    }
  }, []);

  const subscribeToPush = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        alert('יש לאשר קבלת התראות בהגדרות הדפדפן.');
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      let currentVapidKey = vapidKey;
      if (!currentVapidKey) {
        // Fallback if it wasn't pre-fetched in time
        const { data } = await axiosClient.get('/push/public-key');
        currentVapidKey = data.public_key;
      }

      if (!currentVapidKey) {
        console.error('VAPID public key not found');
        alert('שגיאה: חסר מפתח VAPID בשרת. אנא פנה למנהל המערכת.');
        setLoading(false);
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(currentVapidKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      const subData = JSON.parse(JSON.stringify(subscription));

      await axiosClient.post('/push/subscribe', {
        endpoint: subData.endpoint,
        p256dh: subData.keys.p256dh,
        auth: subData.keys.auth
      });

      setIsSubscribed(true);
      alert('ההרשמה להתראות חכמות בוצעה בהצלחה!');
    } catch (error: any) {
      console.error('Error subscribing to push', error);
      if (error.name === 'AbortError') {
        alert('לא ניתן היה להירשם להתראות. אם אתה משתמש בדפדפן סמסונג או במצב חסכון בסוללה, נסה להשתמש ב-Chrome או לאשר התראות דרך הגדרות האתר בדפדפן.');
      } else {
        alert(
          'שגיאה בהרשמה:\\n' + 
          'Message: ' + error.message + '\\n' +
          'Name: ' + error.name
        );
      }
    }
    setLoading(false);
  };

  if (isSubscribed || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
          <BellRing size={20} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900">התראות חכמות</h4>
          <p className="text-sm text-blue-700">הפעל התראות כדי לקבל עדכונים מידיים על שיבוצים חדשים לנייד שלך.</p>
        </div>
      </div>
      <button 
        onClick={subscribeToPush}
        disabled={loading}
        className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow text-sm disabled:bg-gray-400"
      >
        {loading ? 'מפעיל...' : 'הפעל עכשיו'}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
    
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
