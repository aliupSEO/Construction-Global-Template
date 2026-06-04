import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FirebaseErrorFallback } from './components/FirebaseErrorFallback';
import { Toaster } from 'react-hot-toast';

import { SettingsProvider } from './contexts/SettingsContext';

const hasFirebaseConfig = !!import.meta.env.VITE_FIREBASE_API_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <SettingsProvider>
            {hasFirebaseConfig ? <App /> : <FirebaseErrorFallback />}
            <Toaster position="bottom-center" />
        </SettingsProvider>
    </React.StrictMode>,
);
