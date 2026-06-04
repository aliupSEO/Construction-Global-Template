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
        
        const db = admin.firestore();
        
        // Verifiziere, dass der Caller wirklich ein Admin ist
        const callerQuery = await db.collection('apps').doc('satler_bau_bauberichte_satler_v1').collection('employees').where('authUid', '==', decodedToken.uid).get();
        if (callerQuery.empty || callerQuery.docs[0].data()?.role !== 'admin') {
            return res.status(403).json({ error: 'Access Denied: Requires admin role' });
        }

        const { authUid, newRole } = req.body;

        if (!authUid || !newRole) {
            return res.status(400).json({ error: 'Missing required fields (authUid, newRole)' });
        }

        // Führe das Role-Update auf Firebase Firestore Ebene durch (nur users Collection)
        // Setze { merge: true }, falls das Dokument unerwartet nicht existiert
        await db.collection('users').doc(authUid).set({
            role: newRole,
        }, { merge: true });

        // Optional: Custom Claims in Firebase Auth aktualisieren, falls wir in Zukunft 
        // rein Claim-basierte Rules schreiben möchten.
        // await admin.auth().setCustomUserClaims(authUid, { role: newRole });

        return res.status(200).json({ success: true, message: 'Benutzerrolle erfolgreich aktualisiert!' });

    } catch (error: any) {
        console.error('Error updating user role:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
