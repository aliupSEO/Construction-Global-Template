import React from 'react';
import { AlertTriangle, ServerCrash, ExternalLink } from 'lucide-react';

export const FirebaseErrorFallback = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 pl-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 mt-10 rounded-xl shadow-2xl border border-red-100">
                <div className="flex flex-col items-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                        <ServerCrash className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-center text-3xl font-extrabold text-gray-900">
                        System Offline
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Die Anwendung konnte nicht sicher gestartet werden.
                    </p>
                </div>

                <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                                Fehlende Konfiguration (.env)
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>
                                    Dem System fehlen essenzielle Umgebungsvariablen für die Firebase-Anbindung. Aus Sicherheitsgründen wurde der Start abgebrochen, um fehlerhafte Datenbank-Schreibvorgänge zu verhindern.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-sm text-gray-500 border-t border-gray-100 pt-6">
                    <p className="font-bold text-gray-700 mb-2">Entwickler-Checkliste:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Existiert eine <code className="bg-gray-100 px-1 rounded text-red-500">.env</code> Datei im Root-Verzeichnis?</li>
                        <li>Ist <code className="bg-gray-100 px-1 rounded text-red-500">VITE_FIREBASE_API_KEY</code> gesetzt?</li>
                        <li>Ist <code className="bg-gray-100 px-1 rounded text-red-500">VITE_FIREBASE_APP_ID</code> definiert?</li>
                        <li>Tritt dieser Fehler auf Vercel auf? Prüfen Sie die Vercel Environment Settings.</li>
                    </ul>
                </div>

                <div className="pt-4 flex justify-center">
                    <a
                        href="https://vercel.com/docs/concepts/projects/environment-variables"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm font-medium text-brand-primary hover:text-brand-primary/80"
                    >
                        Vercel Env Docs ansehen <ExternalLink className="ml-1 w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
};
