import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CompanyProfile } from '../types';

const COLLECTION_NAME = 'companies';

/**
 * Save or update a company profile in Firestore
 */
export async function saveCompanyToFirestore(company: CompanyProfile): Promise<void> {
  const path = `${COLLECTION_NAME}/${company.id}`;
  try {
    const docRef = doc(db, COLLECTION_NAME, company.id);
    
    // Clean company data object
    const cleanCompanyData = {
      id: company.id,
      razonSocial: company.razonSocial,
      rif: company.rif,
      fiscalYear: Number(company.fiscalYear),
      periodData: company.periodData || {},
      createdAt: company.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, cleanCompanyData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch a single company profile from Firestore by ID
 */
export async function loadCompanyFromFirestore(companyId: string): Promise<CompanyProfile | null> {
  const path = `${COLLECTION_NAME}/${companyId}`;
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as CompanyProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Fetch all company profiles from Firestore
 */
export async function loadAllCompaniesFromFirestore(): Promise<CompanyProfile[]> {
  const path = COLLECTION_NAME;
  try {
    const querySnap = await getDocs(collection(db, COLLECTION_NAME));
    const companies: CompanyProfile[] = [];
    querySnap.forEach((docSnap) => {
      companies.push(docSnap.data() as CompanyProfile);
    });
    return companies;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Delete a company profile from Firestore
 */
export async function deleteCompanyFromFirestore(companyId: string): Promise<void> {
  const path = `${COLLECTION_NAME}/${companyId}`;
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Real-time listener for companies collection changes
 */
export function subscribeToCompaniesFirestore(
  onUpdate: (companies: CompanyProfile[]) => void
) {
  const path = COLLECTION_NAME;
  return onSnapshot(
    collection(db, COLLECTION_NAME),
    (snapshot) => {
      const companies: CompanyProfile[] = [];
      snapshot.forEach((docSnap) => {
        companies.push(docSnap.data() as CompanyProfile);
      });
      onUpdate(companies);
    },
    (error) => {
      console.warn('Firestore subscription fallback (offline or pending):', error);
    }
  );
}
