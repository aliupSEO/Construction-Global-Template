/**
 * Local Dev API Server
 * Mimics Vercel serverless /api/* endpoints locally.
 * Run with: node scripts/dev-api-server.mjs
 * Vite proxies /api/* to this server on port 3001.
 */

import http from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Load .env manually ---
try {
    const envFile = readFileSync(resolve(ROOT, '.env'), 'utf8');
    envFile.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
    });
    console.log('✅ Loaded .env');
} catch (e) {
    console.warn('⚠️  Could not load .env:', e.message);
}

// --- Firebase Admin init (once) ---
import admin from 'firebase-admin';

if (!admin.apps.length) {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('🔑 Using FIREBASE_SERVICE_ACCOUNT JSON from .env');
        credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        console.log('🔑 Using FIREBASE_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY from .env');
        credential = admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, ''),
        });
    } else {
        console.log('🔑 No service account in .env — using Application Default Credentials (ADC)');
        console.log('   To set up ADC, run: gcloud auth application-default login');
        console.log('   Or add FIREBASE_SERVICE_ACCOUNT to your .env file');
        credential = admin.credential.applicationDefault();
    }

    try {
        admin.initializeApp({
            credential,
            projectId: process.env.FIREBASE_PROJECT_ID || 'construction-global-template',
        });
        console.log('✅ Firebase Admin initialized');
    } catch (e) {
        console.error('❌ Firebase Admin init failed:', e.message);
        console.error('   The API server will start but all requests will return 500.');
        console.error('   Fix: add a valid FIREBASE_SERVICE_ACCOUNT or run gcloud auth application-default login');
    }
}

const APP_ID = process.env.VITE_APP_ID || 'construction_global_v1';

// --- Auth helper: verify token + check role ---
async function verifyAdminOrVorarbeiter(authHeader, requireAdmin = false) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Missing or invalid Authorization header', status: 401 };
    }
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
        return { error: 'Invalid or expired token', status: 401 };
    }

    const allowedRoles = requireAdmin ? ['admin'] : ['admin', 'vorarbeiter'];
    if (allowedRoles.includes(decodedToken.role)) {
        return { decodedToken };
    }

    // Fallback: Firestore lookup
    const db = admin.firestore();
    const empQ = await db.collection('apps').doc(APP_ID).collection('employees').where('authUid', '==', decodedToken.uid).get();
    if (!empQ.empty && allowedRoles.includes(empQ.docs[0].data().role)) {
        return { decodedToken };
    }
    const manQ = await db.collection('apps').doc(APP_ID).collection('managers').where('authUid', '==', decodedToken.uid).get();
    if (!manQ.empty && allowedRoles.includes(manQ.docs[0].data().role)) {
        return { decodedToken };
    }

    return { error: 'Access Denied', status: 403 };
}

// --- Parse request body ---
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

// --- Response helpers ---
function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}

// --- Route handlers ---
async function handleCreateUser(req, res) {
    const auth = await verifyAdminOrVorarbeiter(req.headers.authorization);
    if (auth.error) return sendJSON(res, auth.status, { error: auth.error });

    const { email, password, displayName, role } = await parseBody(req);
    if (!email || !password || !displayName || !role) {
        return sendJSON(res, 400, { error: 'Missing required fields' });
    }

    try {
        const userRecord = await admin.auth().createUser({ email, password, displayName });
        await admin.auth().setCustomUserClaims(userRecord.uid, { role, appId: APP_ID });
        console.log(`✅ Created user: ${email} (uid: ${userRecord.uid})`);
        sendJSON(res, 200, { uid: userRecord.uid, message: 'User created successfully' });
    } catch (e) {
        console.error('createUser error:', e.message);
        if (e.code === 'auth/email-already-exists') return sendJSON(res, 400, { error: 'Diese E-Mail-Adresse wird bereits verwendet.' });
        if (e.code === 'auth/invalid-password') return sendJSON(res, 400, { error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
        sendJSON(res, 500, { error: e.message });
    }
}

async function handleUpdateUserAuth(req, res) {
    const auth = await verifyAdminOrVorarbeiter(req.headers.authorization);
    if (auth.error) return sendJSON(res, auth.status, { error: auth.error });

    const { authUid, email, password } = await parseBody(req);
    if (!authUid) return sendJSON(res, 400, { error: 'Missing authUid' });

    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    try {
        if (Object.keys(updateData).length > 0) {
            await admin.auth().updateUser(authUid, updateData);
        }
        console.log(`✅ Updated auth for uid: ${authUid}`);
        sendJSON(res, 200, { success: true, message: 'Auth credentials updated successfully!' });
    } catch (e) {
        console.error('updateUserAuth error:', e.message);
        if (e.code === 'auth/email-already-exists') return sendJSON(res, 400, { error: 'Diese E-Mail-Adresse wird bereits verwendet.' });
        sendJSON(res, 500, { error: e.message });
    }
}

async function handleUpdateUserRole(req, res) {
    const auth = await verifyAdminOrVorarbeiter(req.headers.authorization, true);
    if (auth.error) return sendJSON(res, auth.status, { error: auth.error });

    const { authUid, newRole } = await parseBody(req);
    if (!authUid || !newRole) return sendJSON(res, 400, { error: 'Missing required fields (authUid, newRole)' });

    try {
        const db = admin.firestore();
        const empQ = await db.collection('apps').doc(APP_ID).collection('employees').where('authUid', '==', authUid).get();
        if (!empQ.empty) {
            await empQ.docs[0].ref.update({ role: newRole });
        } else {
            const manQ = await db.collection('apps').doc(APP_ID).collection('managers').where('authUid', '==', authUid).get();
            if (!manQ.empty) await manQ.docs[0].ref.update({ role: newRole });
        }
        await admin.auth().setCustomUserClaims(authUid, { role: newRole, appId: APP_ID });
        console.log(`✅ Updated role for uid: ${authUid} → ${newRole}`);
        sendJSON(res, 200, { success: true, message: 'Benutzerrolle erfolgreich aktualisiert!' });
    } catch (e) {
        console.error('updateUserRole error:', e.message);
        sendJSON(res, 500, { error: e.message });
    }
}

// --- HTTP Server ---
const PORT = 3001;
const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        return res.end();
    }

    const url = req.url?.split('?')[0];
    console.log(`→ ${req.method} ${url}`);

    try {
        if (url === '/api/createUser' && req.method === 'POST') return await handleCreateUser(req, res);
        if (url === '/api/updateUserAuth' && req.method === 'POST') return await handleUpdateUserAuth(req, res);
        if (url === '/api/updateUserRole' && req.method === 'POST') return await handleUpdateUserRole(req, res);
        sendJSON(res, 404, { error: `No handler for ${url}` });
    } catch (e) {
        console.error('Unhandled error:', e);
        sendJSON(res, 500, { error: 'Internal Server Error' });
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 Dev API server running at http://localhost:${PORT}`);
    console.log('   Handles: /api/createUser, /api/updateUserAuth, /api/updateUserRole\n');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error(`   Kill the old process with: lsof -ti:${PORT} | xargs kill -9`);
        console.error(`   Then run: npm run dev:full\n`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});
