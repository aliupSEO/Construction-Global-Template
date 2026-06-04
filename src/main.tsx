import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FirebaseErrorFallback } from './components/FirebaseErrorFallback';
import { Toaster } from 'react-hot-toast';

const hasFirebaseConfig = !!import.meta.env.VITE_FIREBASE_API_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {hasFirebaseConfig ? <App /> : <FirebaseErrorFallback />}
        <Toaster position="bottom-center" />
    </React.StrictMode>,
);
