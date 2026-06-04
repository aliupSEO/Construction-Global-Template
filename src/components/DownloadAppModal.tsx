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
        <div className="p-8 pb-6 relative flex flex-col items-center text-center">
          {view !== 'selection' && (
             <button
                onClick={() => setView('selection')}
                className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all"
                title="Zurück zur Auswahl"
             >
                <ArrowLeft className="w-5 h-5" />
             </button>
          )}

          <button
            onClick={handleClose}
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="bg-brand-primary/10 p-4 rounded-full mb-5 shadow-inner border border-brand-primary/20">
            {view === 'selection' && <Download className="w-10 h-10 text-brand-primary" />}
            {view === 'mobile' && <Smartphone className="w-10 h-10 text-brand-primary" />}
            {view === 'desktop' && <Monitor className="w-10 h-10 text-brand-primary" />}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
             {view === 'selection' && 'App installieren'}
             {view === 'mobile' && 'Als Handyapp installieren'}
             {view === 'desktop' && 'Auf dem Computer installieren'}
          </h2>
          
          <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">
             {view === 'selection' && 'Wähle dein aktuelles Gerät aus, um die passenden Installationshinweise zu erhalten.'}
             {view === 'mobile' && 'Installiere Construction Global Template direkt auf deinem Homescreen.'}
             {view === 'desktop' && 'Installiere die App auf deinem PC oder Mac für schnellen Zugriff.'}
          </p>
        </div>

        {/* Content Dynamisch */}
        <div className="px-8 pb-8">
          {view === 'selection' && (
             <div className="space-y-4">
                <button
                   onClick={() => setView('mobile')}
                   className="w-full group flex items-center space-x-4 p-5 border border-gray-200 rounded-2xl hover:border-brand-primary hover:bg-brand-primary/5 hover:shadow-md transition-all text-left"
                >
                   <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl text-gray-500 group-hover:text-brand-primary group-hover:bg-white group-hover:shadow-sm transition-all shrink-0">
                      <Smartphone className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-primary transition-colors">Handy / Tablet</h3>
                      <p className="text-sm text-gray-500">Für iOS und Android Geräte</p>
                   </div>
                </button>

                <button
                   onClick={() => setView('desktop')}
                   className="w-full group flex items-center space-x-4 p-5 border border-gray-200 rounded-2xl hover:border-brand-primary hover:bg-brand-primary/5 hover:shadow-md transition-all text-left"
                >
                   <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl text-gray-500 group-hover:text-brand-primary group-hover:bg-white group-hover:shadow-sm transition-all shrink-0">
                      <Monitor className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-primary transition-colors">Computer (PC / Mac)</h3>
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
        
        <div className="bg-gray-50/80 p-5 border-t border-gray-100 flex justify-center">
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-900 font-semibold text-sm px-6 py-2 rounded-full hover:bg-gray-200/50 transition-colors">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
