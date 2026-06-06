import type { VercelRequest, VercelResponse } from '@vercel/node';

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || '';
const MIN_SCORE = 0.5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ success: false, error: 'Missing reCAPTCHA token' });
    }

    try {
        const response = await fetch(
            `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${token}`,
            { method: 'POST' }
        );
        const data = await response.json();

        if (!data.success) {
            return res.status(400).json({ success: false, error: 'reCAPTCHA verification failed', codes: data['error-codes'] });
        }

        if (data.score < MIN_SCORE) {
            return res.status(403).json({ success: false, error: 'Suspicious activity detected. Please try again.', score: data.score });
        }

        return res.status(200).json({ success: true, score: data.score });
    } catch (err: any) {
        console.error('reCAPTCHA verify error:', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}
