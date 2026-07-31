import { useEffect, useState } from 'react';

// Usado pelo AppLayout (desktop) e pelo MobileLayout (celular) pra mostrar o mesmo aviso de
// "sem conexão" nos dois — sem duplicar o listener de online/offline em cada um.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
