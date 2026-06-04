import { collection, doc, setDoc, getDocs, query, where, orderBy, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/firebase';
import { LeaveRequest } from '../types';

/**
 * Creates a human-readable ID for a leave request based on the employee's name and current timestamp.
 * Example: req_max_mustermann_1713525603
 */
const generateCustomId = (employeeName: string): string => {
    const slug = employeeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_+|_+$)/g, '');
    const timestamp = Math.floor(Date.now() / 1000);
    return `req_${slug}_${timestamp}`;
};

/**
 * Creates a new leave request.
 */
export const createLeaveRequest = async (data: Omit<LeaveRequest, 'id' | 'createdAt'>): Promise<string> => {
    const customId = generateCustomId(data.employeeName);
    const docRef = doc(db, 'apps', APP_ID, 'leave_requests', customId);
    
    // Check if we need to add timestamps. Usually we use serverTimestamp(), but the model asks for 'createdAt: number'
    const now = Date.now();

    await setDoc(docRef, { ...data, id: customId, createdAt: now });
    return customId;
};

/**
 * Gets all leave requests for a specific employee.
 */
export const getLeaveRequestsByEmployee = async (employeeId: string): Promise<LeaveRequest[]> => {
    const q = query(
        collection(db, 'apps', APP_ID, 'leave_requests'),
        where('employeeId', '==', employeeId)
    );
    const querySnapshot = await getDocs(q);
    
    const requests = querySnapshot.docs.map(doc => doc.data() as LeaveRequest);
    // Sort descending by createdAt since we cannot easily compound-query without an index
    return requests.sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Gets all pending leave requests (for admins).
 * Since we don't have indexes explicitly requested, we'll fetch pending and sort in client.
 */
export const getAllPendingRequests = async (): Promise<LeaveRequest[]> => {
    const q = query(
        collection(db, 'apps', APP_ID, 'leave_requests'),
        where('status', 'in', ['pending', 'needs_info'])
    );
    const querySnapshot = await getDocs(q);
    
    const requests = querySnapshot.docs.map(doc => doc.data() as LeaveRequest);
    return requests.sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Gets all handled (approved/rejected) leave requests (for admins).
 */
export const getHandledRequests = async (): Promise<LeaveRequest[]> => {
    const q = query(
        collection(db, 'apps', APP_ID, 'leave_requests'),
        where('status', 'in', ['approved', 'rejected'])
    );
    const querySnapshot = await getDocs(q);
    
    const requests = querySnapshot.docs.map(doc => doc.data() as LeaveRequest);
    return requests.sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Updates the status (and adminComment) of a leave request.
 */
export const updateLeaveRequestStatus = async (id: string, status: 'approved' | 'rejected' | 'needs_info', adminComment?: string): Promise<void> => {
    const docRef = doc(db, 'apps', APP_ID, 'leave_requests', id);
    const updateData: Partial<LeaveRequest> = { status };
    if (adminComment !== undefined) {
        updateData.adminComment = adminComment;
    }
    await updateDoc(docRef, updateData);
};

export const replyToLeaveRequestQuery = async (id: string, currentReason: string, replyText: string): Promise<void> => {
    const docRef = doc(db, 'apps', APP_ID, 'leave_requests', id);
    await updateDoc(docRef, {
        status: 'pending',
        reason: `${currentReason} | Antwort d. Mitarbeiters: ${replyText}`,
        adminComment: '' // Clear the admin query so it doesn't show old text as red warning
    });
};
