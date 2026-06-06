/**
 * Unit tests for the soft-delete utility.
 * These tests run fully offline — no Firebase connection needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase before importing the module under test
vi.mock('../lib/firebase', () => ({
    db: {},
    APP_ID: 'test_app',
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    Timestamp: {
        fromDate: vi.fn((date: Date) => ({ toDate: () => date, _seconds: Math.floor(date.getTime() / 1000) })),
    },
}));

import { softDelete, restoreItem, permanentDelete, getDaysUntilExpiry } from '../lib/softDelete';
import * as firestore from 'firebase/firestore';

describe('softDelete()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls updateDoc with isDeleted=true and expireAt set', async () => {
        const updateDocMock = vi.mocked(firestore.updateDoc);

        await softDelete('employees', 'emp123', { uid: 'user1', name: 'Admin' });

        expect(updateDocMock).toHaveBeenCalledOnce();
        const [, payload] = updateDocMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>];
        expect(payload).toMatchObject({
            isDeleted: true,
            deletedBy: 'user1',
            deletedByName: 'Admin',
            deletedAt: 'SERVER_TIMESTAMP',
        });
        // expireAt should be a Timestamp ~30 days from now
        expect(payload['expireAt']).toBeDefined();
    });

    it('targets the correct Firestore document path', async () => {
        const docMock = vi.mocked(firestore.doc);

        await softDelete('daily_reports', 'report456', { uid: 'u1', name: 'Test' });

        expect(docMock).toHaveBeenCalledWith({}, 'apps', 'test_app', 'daily_reports', 'report456');
    });
});

describe('restoreItem()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears all soft-delete fields', async () => {
        const updateDocMock = vi.mocked(firestore.updateDoc);

        await restoreItem('employees', 'emp123');

        expect(updateDocMock).toHaveBeenCalledOnce();
        const [, payload] = updateDocMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>];
        expect(payload).toMatchObject({
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            deletedByName: null,
            expireAt: null,
        });
    });
});

describe('permanentDelete()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls deleteDoc on the correct document', async () => {
        const deleteDocMock = vi.mocked(firestore.deleteDoc);

        await permanentDelete('baustellen', 'site789');

        expect(deleteDocMock).toHaveBeenCalledOnce();
    });
});

describe('getDaysUntilExpiry()', () => {
    it('returns correct days for a Timestamp-like object', () => {
        const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
        const fakeTimestamp = { toDate: () => futureDate };

        const result = getDaysUntilExpiry(fakeTimestamp);
        expect(result).toBe(15);
    });

    it('returns 0 for an expired timestamp', () => {
        const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        const fakeTimestamp = { toDate: () => pastDate };

        expect(getDaysUntilExpiry(fakeTimestamp)).toBe(0);
    });

    it('returns 0 for null/undefined', () => {
        expect(getDaysUntilExpiry(null)).toBe(0);
        expect(getDaysUntilExpiry(undefined)).toBe(0);
    });
});
