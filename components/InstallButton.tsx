import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';

export default function InstallButton() {
  const [promptAvailable, setPromptAvailable] = useState(false);
  const toast = useToast();

  useEffect(() => {
    try {
      setPromptAvailable(!!(window as any).__trohmDeferredPrompt);
      const onPrompt = () => setPromptAvailable(true);
      window.addEventListener('beforeinstallprompt', onPrompt as EventListener);
      return () => window.removeEventListener('beforeinstallprompt', onPrompt as EventListener);
    } catch (e) {
      // ignore
    }
  }, []);

  async function install() {
    try {
      const e = (window as any).__trohmDeferredPrompt;
      if (!e) return;
      // show the browser prompt
      e.prompt();
      const choice = await e.userChoice;
      // clear stored prompt regardless of choice
      (window as any).__trohmDeferredPrompt = null;
      setPromptAvailable(false);
      if (choice && choice.outcome === 'accepted') {
        toast.show('App instalada correctamente', 'success', 3000);
      } else {
        toast.show('Instalación cancelada', 'info', 3000);
      }
      return choice;
    } catch (err) {
      // show an error toast if something goes wrong
      try { toast.show('Error al intentar instalar', 'error', 4000); } catch (e) {}
    }
  }

  if (!promptAvailable) return null;

  return (
    <button className="btn btn-primary" onClick={install} title="Instalar Tr0hm">
      Instalar app
    </button>
  );
}
