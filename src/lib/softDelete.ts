import { doc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, APP_ID } from './firebase';

const TTL_DAYS = 30;

/**
 * Soft-delete a document. Sets isDeleted=true + expireAt (30 days).
 * Firestore TTL policy on the `expireAt` field will auto-purge after 30 days.
 */
export const softDelete = async (
    collectionName: string,
    id: string,
    deletedBy: { uid: string; name: string }
) => {
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + TTL_DAYS);

    await updateDoc(doc(db, 'apps', APP_ID, collectionName, id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy.uid,
        deletedByName: deletedBy.name,
        expireAt: Timestamp.fromDate(expireAt),
    });
};

/**
 * Restore a soft-deleted document.
 */
export const restoreItem = async (collectionName: string, id: string) => {
    await updateDoc(doc(db, 'apps', APP_ID, collectionName, id), {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deletedByName: null,
        expireAt: null,
    });
};

/**
 * Permanently delete a document (hard delete). Only used from trash view.
 */
export const permanentDelete = async (collectionName: string, id: string) => {
    await deleteDoc(doc(db, 'apps', APP_ID, collectionName, id));
};

/**
 * Returns how many days until the item is auto-purged from Firestore.
 */
export const getDaysUntilExpiry = (expireAt: any): number => {
    if (!expireAt) return 0;
    const expireDate = expireAt.toDate ? expireAt.toDate() : new Date(expireAt);
    const diff = expireDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
