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
    // Enable CORS for testing if needed
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        // Verify token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (authErr) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const APP_ID = process.env.VITE_APP_ID || 'construction_global_v1';
        let hasAccess = false;

        // 1. Check Custom Claims first (Fastest, most secure)
        if (decodedToken.role === 'admin') {
            hasAccess = true;
        } else {
            // 2. Fallback to Firestore lookup if claims aren't set yet
            const db = admin.firestore();
            const callerQuery = await db.collection('apps').doc(APP_ID).collection('employees').where('authUid', '==', decodedToken.uid).get();
            if (!callerQuery.empty && callerQuery.docs[0].data()?.role === 'admin') {
                hasAccess = true;
            } else {
                const callerQueryMan = await db.collection('apps').doc(APP_ID).collection('managers').where('authUid', '==', decodedToken.uid).get();
                if (!callerQueryMan.empty && callerQueryMan.docs[0].data()?.role === 'admin') {
                    hasAccess = true;
                }
            }
        }

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access Denied: Requires admin role' });
        }

        const { authUid, newRole } = req.body;

        if (!authUid || !newRole) {
            return res.status(400).json({ error: 'Missing required fields (authUid, newRole)' });
        }

        // Führe das Role-Update auf Firebase Firestore Ebene durch
        const employeeQuery = await db.collection('apps').doc(APP_ID).collection('employees').where('authUid', '==', authUid).get();
        if (!employeeQuery.empty) {
            await employeeQuery.docs[0].ref.update({
                role: newRole,
            });
        } else {
            const managerQuery = await db.collection('apps').doc(APP_ID).collection('managers').where('authUid', '==', authUid).get();
            if (!managerQuery.empty) {
                await managerQuery.docs[0].ref.update({
                    role: newRole,
                });
            }
        }

        // Custom Claims in Firebase Auth aktualisieren
        await admin.auth().setCustomUserClaims(authUid, { role: newRole, appId: APP_ID });

        return res.status(200).json({ success: true, message: 'Benutzerrolle erfolgreich aktualisiert!' });

    } catch (error: any) {
        console.error('Error updating user role:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
