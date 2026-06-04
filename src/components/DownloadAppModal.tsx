import React, { useEffect, useState } from 'react';
import { X, Smartphone, Share, PlusSquare, Download, Monitor, ArrowLeft } from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<'selection' | 'mobile' | 'desktop'>('selection');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // iOS Erkennung
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleClose = () => {
    setView('selection');
    onClose();
  };

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      }
    } else {
      alert('Direkte Installation wird von diesem Browser blockiert. Bitte nutze die manuellen Installationshinweise deines Browsers.');
    }
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header Dynamisch */}
        <div className="bg-brand-dark p-6 text-white relative flex flex-col items-center text-center">
          {view !== 'selection' && (
             <button
                onClick={() => setView('selection')}
                className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
                title="Zurück zur Auswahl"
             >
                <ArrowLeft className="w-6 h-6" />
             </button>
          )}

          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="bg-white/10 p-4 rounded-full mb-4">
            {view === 'selection' && <Download className="w-10 h-10 text-brand-primary" />}
            {view === 'mobile' && <Smartphone className="w-10 h-10 text-brand-primary" />}
            {view === 'desktop' && <Monitor className="w-10 h-10 text-brand-primary" />}
          </div>
          
          <h2 className="text-2xl font-bold">
             {view === 'selection' && 'App installieren'}
             {view === 'mobile' && 'Als Handyapp installieren'}
             {view === 'desktop' && 'Auf dem Computer installieren'}
          </h2>
          
          <p className="text-gray-300 mt-2 text-sm">
             {view === 'selection' && 'Wähle dein aktuelles Gerät aus, um die passenden Installationshinweise zu erhalten.'}
             {view === 'mobile' && 'Installiere Construction Global Template direkt auf deinem Homescreen.'}
             {view === 'desktop' && 'Installiere die App auf deinem PC oder Mac für schnellen Zugriff.'}
          </p>
        </div>

        {/* Content Dynamisch */}
        <div className="p-6">
          {view === 'selection' && (
             <div className="space-y-4">
                <button
                   onClick={() => setView('mobile')}
                   className="w-full flex items-center space-x-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                   <div className="bg-gray-100 p-3 rounded-lg text-brand-dark shrink-0">
                      <Smartphone className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="font-bold text-gray-900 text-lg">Handy / Tablet</h3>
                      <p className="text-sm text-gray-500">Für iOS und Android Geräte</p>
                   </div>
                </button>

                <button
                   onClick={() => setView('desktop')}
                   className="w-full flex items-center space-x-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                   <div className="bg-gray-100 p-3 rounded-lg text-brand-dark shrink-0">
                      <Monitor className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="font-bold text-gray-900 text-lg">Computer (PC / Mac)</h3>
                      <p className="text-sm text-gray-500">Für Desktop-Browser</p>
                   </div>
                </button>
             </div>
          )}

          {view === 'mobile' && (
             isIOS ? (
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-gray-100 p-2 rounded-lg text-brand-dark shrink-0">
                      <Share className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">1. Teilen-Menü öffnen</p>
                      <p className="text-sm text-gray-600">Tippe unten in der Safari-Leiste auf das Teilen-Symbol (Viereck mit Pfeil).</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="bg-gray-100 p-2 rounded-lg text-brand-dark shrink-0">
                      <PlusSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">2. Zum Home-Bildschirm</p>
                      <p className="text-sm text-gray-600">Scrolle nach unten und wähle die Option "Zum Home-Bildschirm" aus.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl text-left">
                     <p className="font-bold text-gray-900 mb-3">So installierst du die App auf Android:</p>
                     <ol className="list-decimal list-inside text-sm text-gray-700 space-y-3">
                        <li>Tippe oben rechts in Chrome auf die <strong>drei kleinen Punkte</strong>.</li>
                        <li>Wähle im Menü <strong>"Zum Startbildschirm zufügen"</strong> (oder "App installieren").</li>
                        <li>Bestätige den Vorgang. Die App ist nun auf deinem Handy!</li>
                     </ol>
                  </div>
                </div>
              )
          )}

          {view === 'desktop' && (
             <div className="space-y-4">
                <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl text-left">
                   <p className="font-bold text-gray-900 mb-3">So installierst du die App auf dem Computer:</p>
                   <ol className="list-decimal list-inside text-sm text-gray-700 space-y-3">
                      <li>Klicke ganz oben rechts in der Adresszeile deines Browsers auf das <strong>Installieren-Symbol</strong> (Bildschirm mit Pfeil nach unten).</li>
                      <li><strong>Alternativ:</strong> Öffne das Browser-Menü (drei Punkte oben rechts) und wähle <strong>"App installieren"</strong> oder "Speichern und teilen" &gt; "Seite als App installieren".</li>
                   </ol>
                </div>
             </div>
          )}
        </div>
        
        <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
          <button onClick={handleClose} className="text-gray-500 hover:text-brand-dark font-medium text-sm">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
