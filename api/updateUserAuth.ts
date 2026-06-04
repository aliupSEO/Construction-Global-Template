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
        
        const db = admin.firestore();
        // Das Projekt nutzt scheinbar einen speziellen Auth-Ansatz. Normalerweise holen wir die Rolle aus dem Employee Doc:
        // Da wir in der API keinen direkten Zugriff auf "APP_ID" im Frontend haben, 
        // müssen wir über alle Apps iterieren oder eine Collection Group Query verwenden, falls 'APP_ID' dynamisch ist.
        // Falls APP_ID fix "2H-Web-Solutions/Satler-baubericht" ist:
        const callerQuery = await db.collection('apps').doc('satler_bau_bauberichte_satler_v1').collection('employees').where('authUid', '==', decodedToken.uid).get();
        
        let hasAccess = false;
        if (!callerQuery.empty) {
            const callerData = callerQuery.docs[0].data();
            if (callerData.role === 'admin' || callerData.role === 'vorarbeiter') {
                hasAccess = true;
            }
        } else {
            const callerQueryMan = await db.collection('apps').doc('satler_bau_bauberichte_satler_v1').collection('managers').where('authUid', '==', decodedToken.uid).get();
            if (!callerQueryMan.empty) {
                // Anyone in managers collection is essentially a Vorarbeiter/Admin
                hasAccess = true;
            } else if (decodedToken.email === 'hosiner@satler.com') {
                 hasAccess = true;
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
