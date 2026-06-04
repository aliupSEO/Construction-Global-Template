import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, APP_ID } from '../lib/firebase';

export type Role = 'admin' | 'vorarbeiter' | 'mitarbeiter' | null;

interface AuthContextType {
  currentUser: User | null;
  userRole: Role;
  employeeId: string | null;
  userCollection: 'employees' | 'managers' | null;
  requiresPasswordChange: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userRole: null,
  employeeId: null,
  userCollection: null,
  requiresPasswordChange: false,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [userCollection, setUserCollection] = useState<'employees' | 'managers' | null>(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Normaler Authentication Flow

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          let empDoc = null;
          let docData = null;
          let docColl: 'employees' | 'managers' | null = null;
          let docId = null;

          const qEmp = query(
            collection(db, 'apps', APP_ID, 'employees'),
            where('authUid', '==', user.uid)
          );
          const snapshotEmp = await getDocs(qEmp);
          
          if (!snapshotEmp.empty) {
             empDoc = snapshotEmp.docs[0];
             docData = empDoc.data();
             docId = empDoc.id;
             docColl = 'employees';
          } else {
             const qMan = query(
               collection(db, 'apps', APP_ID, 'managers'),
               where('authUid', '==', user.uid)
             );
             const snapshotMan = await getDocs(qMan);
             if (!snapshotMan.empty) {
                empDoc = snapshotMan.docs[0];
                docData = empDoc.data();
                docId = empDoc.id;
                docColl = 'managers';
             }
          }

          if (empDoc && docData && docColl) {
            setUserRole(docData.role as Role || 'vorarbeiter');
            setEmployeeId(docId);
            setUserCollection(docColl);
            setRequiresPasswordChange(!!docData.password && docData.password !== '');
          } else if (user.email === 'hosiner@satler.com') {
            // Bootstrap Admin Fallback, falls kein Eintrag existiert
            setUserRole('admin');
            setEmployeeId(null);
            setUserCollection(null);
            setRequiresPasswordChange(false);
          } else {
            setUserRole(null);
            setEmployeeId(null);
            setUserCollection(null);
            setRequiresPasswordChange(false);
          }
        } catch (error) {
          console.error("Fehler beim Abrufen der Rolle:", error);
          setUserRole(null);
          setEmployeeId(null);
          setRequiresPasswordChange(false);
        }
      } else {
        setUserRole(null);
        setEmployeeId(null);
        setRequiresPasswordChange(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, employeeId, userCollection, requiresPasswordChange, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
