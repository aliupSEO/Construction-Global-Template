import { useState, useEffect } from 'react';
import { db, APP_ID } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

export interface SystemAction {
    id?: string;
    action_type: string;
    payload: any;
    status: 'pending' | 'processing' | 'completed' | 'error';
    result?: any;
    createdAt?: any;
}

export const useTaskSync = () => {
    const [isOnline, setIsOnline] = useState(true);
    const [actions, setActions] = useState<SystemAction[]>([]);

    // Listen for connection state and action updates
    useEffect(() => {
        // In Firestore, if onSnapshot throws an error, we might be offline
        // or lacking permissions. We track basic state via the snapshot stream.

        const actionsRef = collection(db, 'apps', APP_ID, 'actions');
        // Fetch last 10 actions to keep memory light
        const q = query(actionsRef, orderBy('createdAt', 'desc'), limit(10));

        const unsubscribe = onSnapshot(
            q,
            { includeMetadataChanges: true }, // helps distinguish local vs server
            (snapshot) => {
                // If it's coming from cache and not pending writes, we might be offline,
                // but standard Firebase handles this well. We'll set online to true 
                // if we successfully receive an update from the server.
                if (!snapshot.metadata.fromCache) {
                    setIsOnline(true);
                }

                const fetchedActions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as SystemAction[];

                setActions(fetchedActions);
            },
            (err) => {
                console.warn("TaskSync: Network disconnected or permissions issue.", err);
                setIsOnline(false);
            }
        );

        // Simple check for online state via navigator (as backup if Firestore stream doesn't trigger err)
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Method to create generic tasks mapping into the `actions` collection for n8n
    const createAction = async (action_type: string, payload: any) => {
        try {
            await addDoc(collection(db, 'apps', APP_ID, 'actions'), {
                action_type,
                payload,
                status: 'pending',
                result: null,
                createdAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error("TaskSync: Failed to create action", error);
            return false;
        }
    };

    return {
        isOnline,
        actions,
        pendingCount: actions.filter(a => a.status === 'pending' || a.status === 'processing').length,
        createAction
    };
};
