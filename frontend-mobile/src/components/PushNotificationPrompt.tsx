import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Bell, BellRing } from 'lucide-react';

export default function PushNotificationPrompt() {
  const [permission, setPermission] = useState(Notification.permission);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then(status => {
        status.onchange = () => {
          setPermission(status.state === 'prompt' ? 'default' : (status.state as NotificationPermission));
        };
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
      
      const { data } = await axiosClient.get('/push/public-key');
      const vapidPublicKey = data.public_key;
      if (!vapidPublicKey) {
        console.error('VAPID public key not found');
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

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

      alert('ההרשמה להתראות חכמות בוצעה בהצלחה!');
    } catch (error) {
      console.error('Error subscribing to push', error);
      alert('אירעה שגיאה בעת ההרשמה להתראות.');
    }
    setLoading(false);
  };

  if (permission === 'granted' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
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
