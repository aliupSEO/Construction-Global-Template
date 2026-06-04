import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else {
        credential = admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
        });
    }
    admin.initializeApp({ credential });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (authErr) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const APP_ID = process.env.VITE_APP_ID || 'construction_global_v1';
        let hasAccess = false;

        // 1. Check Custom Claims first
        if (decodedToken.role === 'admin' || decodedToken.role === 'vorarbeiter') {
            hasAccess = true;
        } else {
            // 2. Fallback to Firestore lookup
            const db = admin.firestore();
            const callerQuery = await db.collection('apps').doc(APP_ID).collection('employees').where('authUid', '==', decodedToken.uid).get();
            
            if (!callerQuery.empty) {
                const callerData = callerQuery.docs[0].data();
                if (callerData.role === 'admin' || callerData.role === 'vorarbeiter') {
                    hasAccess = true;
                }
            } else {
                const callerQueryMan = await db.collection('apps').doc(APP_ID).collection('managers').where('authUid', '==', decodedToken.uid).get();
                if (!callerQueryMan.empty) {
                    hasAccess = true;
                }
            }
        }

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access Denied: Requires admin or vorarbeiter role' });
        }

        const { authUid, email, password } = req.body;

        if (!authUid) {
            return res.status(400).json({ error: 'Missing authUid' });
        }

        const updateData: any = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;

        if (Object.keys(updateData).length > 0) {
            await admin.auth().updateUser(authUid, updateData);
        }
        
        return res.status(200).json({ success: true, message: 'Auth credentials updated successfully!' });

    } catch (error: any) {
        console.error('Error updating auth credentials:', error);
        
        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({ error: 'Diese E-Mail-Adresse/Benutzername wird bereits verwendet.' });
        }
        if (error.code === 'auth/invalid-password') {
            return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
        }
        
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
