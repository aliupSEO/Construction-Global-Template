import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

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
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const APP_ID = process.env.VITE_APP_ID || 'construction_global_v1';
        
        let hasAccess = false;

        // 1. Check Custom Claims first (Fastest, most secure)
        if (decodedToken.role === 'admin' || decodedToken.role === 'vorarbeiter') {
            hasAccess = true;
        } else {
            // 2. Fallback to Firestore lookup if claims aren't set yet (e.g., legacy users or first bootstrap)
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

        const { email, password, displayName, role } = req.body;

        if (!email || !password || !displayName || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create the user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        // Set Custom Claims for RBAC
        await admin.auth().setCustomUserClaims(userRecord.uid, { 
            role: role,
            appId: APP_ID
        });

        return res.status(200).json({ uid: userRecord.uid, message: 'User created successfully' });

    } catch (error: any) {
        console.error('Error creating user:', error);
        
        // Handle specific Firebase Auth errors
        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' });
        }
        if (error.code === 'auth/invalid-password') {
            return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
        }
        
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
