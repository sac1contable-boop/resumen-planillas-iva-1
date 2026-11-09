import React, { useState, useEffect } from 'react';
import { CompanyProfile, IvaQuincenaData } from './types';
import {
  createDemoDataset,
  createInitialYearDataset,
  generatePeriodKey,
  sanitizeQuincenaData,
  reconcileAnnualContinuity,
  hasDemoOrSimulatorData,
} from './utils/taxCalculations';
import { exportToExcel } from './utils/excelExporter';
import { exportToPdf } from './utils/pdfExporter';
import {
  saveCompanyToDB,
  loadCompanyFromDB,
  loadAllCompaniesFromDB,
  deleteCompanyFromDB,
} from './utils/storageDb';
import { CompanyHeader } from './components/CompanyHeader';
import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { FileUploadModal } from './components/FileUploadModal';
import { QuincenaDetailModal } from './components/QuincenaDetailModal';
import { TaxAuditInspector } from './components/TaxAuditInspector';
import { CompanyManagerModal } from './components/CompanyManagerModal';
import { AdminDatabaseModal } from './components/AdminDatabaseModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { HistoryArchiveView } from './components/HistoryArchiveView';
import {
  FileSpreadsheet,
  ShieldCheck,
  BookOpen,
  CheckCircle,
  Building2,
  FolderArchive,
} from 'lucide-react';

import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

import {
  saveCompanyToFirestore,
  loadAllCompaniesFromFirestore,
  deleteCompanyFromFirestore,
  subscribeToCompaniesFirestore,
} from './utils/firestoreDb';

const STORAGE_ACTIVE_KEY = 'seniat_iva_active_company_id_v2';
const STORAGE_LEGACY_KEY = 'seniat_iva_company_v2';

export default function App() {
  // Multi-Company State
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('company-punto-verde');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // Active View Tab: 'matrix' | 'archive' | 'audit' | 'guide'
  const [activeTab, setActiveTab] = useState<'matrix' | 'archive' | 'audit' | 'guide'>('matrix');

  // Month filter for grid
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number | null>(null);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCompanyManagerOpen, setIsCompanyManagerOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [inspectingQuincena, setInspectingQuincena] = useState<IvaQuincenaData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Authentication & Admin State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('seniat_iva_admin_user') || null;
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setCurrentUserEmail(user.email);
        if (user.email.toLowerCase() === 'sac1contable@gmail.com') {
          localStorage.setItem('seniat_iva_admin_user', user.email);
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // Trigger Admin Auth (Opens modal with Master PIN or Google Login)
  const handleOpenAdminAccess = () => {
    if (currentUserEmail?.toLowerCase() === 'sac1contable@gmail.com') {
      setIsAdminModalOpen(true);
    } else {
      setIsAdminAuthModalOpen(true);
    }
  };

  const handleAdminAuthenticated = (email: string) => {
    setCurrentUserEmail(email);
    localStorage.setItem('seniat_iva_admin_user', email);
    showToast(`🔑 Acceso de Administrador confirmado: ${email}`);
    setIsAdminModalOpen(true);
  };

  // Sign-Out Trigger
  const handleSignOut = async () => {
    try {
      localStorage.removeItem('seniat_iva_admin_user');
      await signOut(auth).catch(() => {});
      setCurrentUserEmail(null);
      setIsAdminModalOpen(false);
      setIsAdminAuthModalOpen(false);
      showToast('Sesión de administrador cerrada.');
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  // Initial load of all companies from Firestore (with IndexedDB fallback) & real-time sync
  useEffect(() => {
    async function initMultiCompanyStore() {
      try {
        const PUNTO_VERDE_ID = 'company-punto-verde';
        const PUNTO_VERDE_NAME = 'PANIFICADORA Y TEQUEÑERIA TU PUNTO VERDE, C.A.';
        const PUNTO_VERDE_RIF = 'J-501438260';

        // 1. Try loading from Firestore database
        let cloudCompanies = await loadAllCompaniesFromFirestore();
        let loadedList: CompanyProfile[] = [];

        if (cloudCompanies && cloudCompanies.length > 0) {
          loadedList = cloudCompanies.map((comp) => {
            const isPuntoVerde =
              comp.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
              comp.razonSocial.toUpperCase().includes('PANIFICADORA');

            const yearBase = createInitialYearDataset(comp.fiscalYear || 2025);

            // Guarantee Punto Verde has NO fictitious or simulator numbers
            if (isPuntoVerde && hasDemoOrSimulatorData(comp.periodData)) {
              return {
                ...comp,
                fiscalYear: comp.fiscalYear || 2025,
                periodData: yearBase,
              };
            }

            const sanitizedPeriods: Record<string, IvaQuincenaData> = {};
            Object.entries(comp.periodData || {}).forEach(([k, v]) => {
              sanitizedPeriods[k] = sanitizeQuincenaData(v as IvaQuincenaData);
            });

            return {
              ...comp,
              fiscalYear: comp.fiscalYear || 2025,
              periodData: { ...yearBase, ...sanitizedPeriods },
            };
          });
          setIsCloudSynced(true);
        } else {
          // 2. Fallback to local IndexedDB
          const dbCompanies = await loadAllCompaniesFromDB();
          if (dbCompanies && dbCompanies.length > 0) {
            loadedList = dbCompanies.map((comp) => {
              const isPuntoVerde =
                comp.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
                comp.razonSocial.toUpperCase().includes('PANIFICADORA');

              const yearBase = createInitialYearDataset(comp.fiscalYear || 2025);

              if (isPuntoVerde && hasDemoOrSimulatorData(comp.periodData)) {
                return {
                  ...comp,
                  fiscalYear: comp.fiscalYear || 2025,
                  periodData: yearBase,
                };
              }

              const sanitizedPeriods: Record<string, IvaQuincenaData> = {};
              Object.entries(comp.periodData || {}).forEach(([k, v]) => {
                sanitizedPeriods[k] = sanitizeQuincenaData(v as IvaQuincenaData);
              });

              return {
                ...comp,
                fiscalYear: comp.fiscalYear || 2025,
                periodData: { ...yearBase, ...sanitizedPeriods },
              };
            });
          } else {
            // Check LocalStorage fallback
            const savedActive = localStorage.getItem(STORAGE_LEGACY_KEY);
            if (savedActive) {
              try {
                const parsed: CompanyProfile = JSON.parse(savedActive);
                const isPuntoVerde =
                  parsed.razonSocial?.toUpperCase().includes('PUNTO VERDE') ||
                  parsed.razonSocial?.toUpperCase().includes('PANIFICADORA');

                const yearBase = createInitialYearDataset(parsed.fiscalYear || 2025);

                const sanitizedPeriods: Record<string, IvaQuincenaData> = {};
                if (!isPuntoVerde || !hasDemoOrSimulatorData(parsed.periodData)) {
                  Object.entries(parsed.periodData || {}).forEach(([k, v]) => {
                    sanitizedPeriods[k] = sanitizeQuincenaData(v);
                  });
                }

                const fallbackComp: CompanyProfile = {
                  ...parsed,
                  id: parsed.id || 'company-default',
                  razonSocial: parsed.razonSocial || 'JMC SUPPLY, C.A.',
                  rif: parsed.rif || 'J-411499455',
                  fiscalYear: parsed.fiscalYear || 2025,
                  periodData: { ...yearBase, ...sanitizedPeriods },
                };
                loadedList = [fallbackComp];
              } catch (e) {
                console.warn('Fallback JSON parse error:', e);
              }
            }
          }
        }

        // Guarantee "PANIFICADORA Y TEQUEÑERIA TU PUNTO VERDE, C.A." is present and 100% clean
        const pvIdx = loadedList.findIndex(
          (c) =>
            c.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
            c.razonSocial.toUpperCase().includes('PANIFICADORA')
        );

        let pvIdToActivate = PUNTO_VERDE_ID;

        if (pvIdx >= 0) {
          const existing = loadedList[pvIdx];
          // Ensure no simulator/demo data in Punto Verde
          if (hasDemoOrSimulatorData(existing.periodData)) {
            loadedList[pvIdx] = {
              ...existing,
              periodData: createInitialYearDataset(existing.fiscalYear || 2025),
              updatedAt: new Date().toISOString(),
            };
          }
          pvIdToActivate = existing.id;
        } else {
          // Create pristine clean format for PANIFICADORA Y TEQUEÑERIA TU PUNTO VERDE, C.A.
          const cleanPuntoVerde: CompanyProfile = {
            id: PUNTO_VERDE_ID,
            razonSocial: PUNTO_VERDE_NAME,
            rif: PUNTO_VERDE_RIF,
            fiscalYear: 2025,
            periodData: createInitialYearDataset(2025), // 100% clean zeros across all 24 periods
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          loadedList.unshift(cleanPuntoVerde);
          pvIdToActivate = cleanPuntoVerde.id;
        }

        // Also ensure JMC SUPPLY, C.A. is preserved as an alternative company
        if (!loadedList.some((c) => c.razonSocial.toUpperCase().includes('JMC SUPPLY'))) {
          loadedList.push({
            id: 'company-jmc-supply',
            razonSocial: 'JMC SUPPLY, C.A.',
            rif: 'J-411499455',
            fiscalYear: 2025,
            periodData: createInitialYearDataset(2025),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Sync all loaded/created companies to Firestore and IndexedDB
        for (const c of loadedList) {
          await saveCompanyToFirestore(c).catch((e) => console.warn('Firestore sync error:', e));
          await saveCompanyToDB(c).catch((e) => console.warn('IndexedDB sync error:', e));
        }

        setCompanies(loadedList);
        setIsCloudSynced(true);

        // Prioritize PANIFICADORA Y TEQUEÑERIA TU PUNTO VERDE, C.A. as active company
        setActiveCompanyId(pvIdToActivate);
        localStorage.setItem(STORAGE_ACTIVE_KEY, pvIdToActivate);
      } catch (err) {
        console.error('Error initializing database:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    initMultiCompanyStore();

    // Subscribe to Firestore real-time updates across devices/tabs
    const unsubscribe = subscribeToCompaniesFirestore((cloudComps) => {
      if (cloudComps && cloudComps.length > 0) {
        const sanitizedList = cloudComps.map((comp) => {
          const isPuntoVerde =
            comp.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
            comp.razonSocial.toUpperCase().includes('PANIFICADORA');

          const yearBase = createInitialYearDataset(comp.fiscalYear || 2025);

          // Guarantee Punto Verde never has simulator / demo values
          if (isPuntoVerde && hasDemoOrSimulatorData(comp.periodData)) {
            return {
              ...comp,
              fiscalYear: comp.fiscalYear || 2025,
              periodData: yearBase,
            };
          }

          const sanitizedPeriods: Record<string, IvaQuincenaData> = {};
          Object.entries(comp.periodData || {}).forEach(([k, v]) => {
            sanitizedPeriods[k] = sanitizeQuincenaData(v as IvaQuincenaData);
          });

          return {
            ...comp,
            fiscalYear: comp.fiscalYear || 2025,
            periodData: { ...yearBase, ...sanitizedPeriods },
          };
        });
        setCompanies(sanitizedList);
        setIsCloudSynced(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Get active company object safely
  const company =
    companies.find((c) => c.id === activeCompanyId) ||
    companies.find(
      (c) =>
        c.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
        c.razonSocial.toUpperCase().includes('PANIFICADORA')
    ) ||
    companies[0] || {
      id: 'company-punto-verde',
      razonSocial: 'PANIFICADORA Y TEQUEÑERIA TU PUNTO VERDE, C.A.',
      rif: 'J-501438260',
      fiscalYear: 2025,
      periodData: createInitialYearDataset(2025),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

  // Toast notification helper
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Save active company changes to Firestore & IndexedDB & LocalStorage
  const updateCompanyInStateAndDB = (updatedComp: CompanyProfile) => {
    setCompanies((prev) => {
      const exists = prev.some((c) => c.id === updatedComp.id);
      if (exists) {
        return prev.map((c) => (c.id === updatedComp.id ? updatedComp : c));
      }
      return [updatedComp, ...prev];
    });
    setActiveCompanyId(updatedComp.id);

    // Firestore cloud database save
    saveCompanyToFirestore(updatedComp).catch((err) =>
      console.warn('Error saving company to Firestore:', err)
    );
    // Offline IndexedDB backup
    saveCompanyToDB(updatedComp).catch((err) =>
      console.warn('Error saving company to IndexedDB:', err)
    );

    // Save lightweight copy to LocalStorage
    try {
      localStorage.setItem(STORAGE_ACTIVE_KEY, updatedComp.id);
      const lightweightCompany: CompanyProfile = {
        ...updatedComp,
        periodData: Object.fromEntries(
          Object.entries(updatedComp.periodData || {}).map(([k, v]: [string, IvaQuincenaData]) => {
            const { rawPdfText, ...rest } = v;
            return [k, rest as IvaQuincenaData];
          })
        ),
      };
      localStorage.setItem(STORAGE_LEGACY_KEY, JSON.stringify(lightweightCompany));
    } catch (e) {
      console.warn('LocalStorage save bypassed:', e);
    }
  };

  // Switch Active Company
  const handleSelectCompany = (id: string) => {
    const target = companies.find((c) => c.id === id);
    if (target) {
      setActiveCompanyId(id);
      localStorage.setItem(STORAGE_ACTIVE_KEY, id);
      showToast(`Empresa activa: "${target.razonSocial}" (Año ${target.fiscalYear}).`);
    }
  };

  // Create New Company
  const handleCreateCompany = (newCompany: CompanyProfile) => {
    setCompanies((prev) => [...prev, newCompany]);
    setActiveCompanyId(newCompany.id);
    localStorage.setItem(STORAGE_ACTIVE_KEY, newCompany.id);
    saveCompanyToFirestore(newCompany).catch((err) => console.warn('Firestore save error:', err));
    saveCompanyToDB(newCompany).catch((err) => console.warn('IndexedDB save error:', err));
    showToast(`Empresa "${newCompany.razonSocial}" guardada en la base de datos.`);
  };

  // Update Company Profile
  const handleUpdateCompany = (updatedCompany: CompanyProfile) => {
    updateCompanyInStateAndDB(updatedCompany);
    showToast(`Datos de "${updatedCompany.razonSocial}" guardados en la base de datos.`);
  };

  // Delete Company (Only deleted when user explicitly decides)
  const handleDeleteCompany = (id: string) => {
    if (companies.length <= 1) {
      alert('Debe existir al menos una empresa registrada.');
      return;
    }
    const remaining = companies.filter((c) => c.id !== id);
    setCompanies(remaining);
    deleteCompanyFromFirestore(id).catch((err) => console.warn('Firestore delete error:', err));
    deleteCompanyFromDB(id).catch((err) => console.warn('IndexedDB delete error:', err));

    if (activeCompanyId === id) {
      const nextActive = remaining[0];
      setActiveCompanyId(nextActive.id);
      localStorage.setItem(STORAGE_ACTIVE_KEY, nextActive.id);
    }
    showToast(`Empresa eliminada explícitamente de la base de datos.`);
  };

  // Reconcile continuity across all 24 quincenas for active company
  const handleReconcileAll = () => {
    const { updatedPeriodData } = reconcileAnnualContinuity(company.fiscalYear, company.periodData || {});
    const updatedComp = {
      ...company,
      periodData: updatedPeriodData,
      updatedAt: new Date().toISOString(),
    };
    updateCompanyInStateAndDB(updatedComp);
    showToast(`✨ Saldos de excedentes y retenciones conciliados con éxito en las 24 quincenas.`);
  };

  // Update a single quincena in active company
  const handleUpdateQuincena = (updatedData: IvaQuincenaData) => {
    const cleanData = sanitizeQuincenaData(updatedData);
    const updatedComp = {
      ...company,
      periodData: {
        ...(company.periodData || {}),
        [cleanData.id]: cleanData,
      },
      updatedAt: new Date().toISOString(),
    };
    updateCompanyInStateAndDB(updatedComp);
    showToast(`Quincena actualizada y calibrada.`);
  };

  // Handle batch extracted PDFs
  const handleBatchExtracted = (
    results: {
      quincenaData: IvaQuincenaData;
      razonSocial?: string;
      rif?: string;
      fiscalYear?: number;
    }[]
  ) => {
    if (!results || results.length === 0) return;

    let newRazonSocial = company.razonSocial;
    let newRif = company.rif;
    let newYear = company.fiscalYear;

    // Detect if results contain a specific fiscal year
    const detectedYear = results.find((r) => r.fiscalYear)?.fiscalYear || results[0]?.quincenaData?.year;
    if (detectedYear && detectedYear >= 2000 && detectedYear <= 2100) {
      newYear = detectedYear;
    }

    const yearBase = createInitialYearDataset(newYear);
    const updatedPeriodData = {
      ...yearBase,
      ...(company.periodData || {}),
    };

    results.forEach((res) => {
      if (res.razonSocial && res.razonSocial !== 'EMPRESA CONTRIBUYENTE, C.A') {
        newRazonSocial = res.razonSocial;
      }
      if (res.rif && res.rif !== 'J-00000000-0') {
        newRif = res.rif;
      }
      const cleaned = sanitizeQuincenaData(res.quincenaData);
      updatedPeriodData[cleaned.id] = cleaned;
    });

    // Auto reconcile continuity after batch upload for this year
    const { updatedPeriodData: autoReconciled } = reconcileAnnualContinuity(newYear, updatedPeriodData);

    const updatedComp: CompanyProfile = {
      ...company,
      razonSocial: newRazonSocial,
      rif: newRif,
      fiscalYear: newYear,
      periodData: {
        ...(company.periodData || {}),
        ...autoReconciled,
      },
      updatedAt: new Date().toISOString(),
    };

    updateCompanyInStateAndDB(updatedComp);
    setIsUploadModalOpen(false);
    showToast(`✓ Se han insertado y conciliado ${results.length} planillas en el resumen de ${newRazonSocial} (${newYear}).`);
  };

  // Update active company metadata from header
  const handleUpdateCompanyInfo = (razonSocial: string, rif: string, fiscalYear: number) => {
    let periodData = company.periodData;
    if (fiscalYear !== company.fiscalYear) {
      const yearBase = createInitialYearDataset(fiscalYear);
      periodData = { ...yearBase, ...company.periodData };
    }
    const updatedComp = {
      ...company,
      razonSocial,
      rif,
      fiscalYear,
      periodData,
      updatedAt: new Date().toISOString(),
    };
    updateCompanyInStateAndDB(updatedComp);
    showToast(`Información de la empresa actualizada.`);
  };

  // Load demo data into active company
  const handleLoadDemoData = () => {
    const isPuntoVerde =
      company.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
      company.razonSocial.toUpperCase().includes('PANIFICADORA');
    if (
      isPuntoVerde &&
      !window.confirm(
        'La empresa "PANIFICADORA Y TEQUEÑERIA TU PUNTO VERDE, C.A." está configurada con formato limpio para información real. ¿Deseas realmente cargar datos de prueba simulados?'
      )
    ) {
      return;
    }
    const demo = createDemoDataset(company.fiscalYear || 2025);
    const updatedComp = {
      ...company,
      periodData: demo.periodData,
      updatedAt: new Date().toISOString(),
    };
    updateCompanyInStateAndDB(updatedComp);
    showToast(`Datos demo cargados en "${company.razonSocial}" (Año ${company.fiscalYear}).`);
  };

  // Clear active company fiscal year
  const handleClearYear = () => {
    if (window.confirm(`¿Estás seguro de limpiar todos los datos del año fiscal ${company.fiscalYear} para "${company.razonSocial}"?`)) {
      const updatedComp = {
        ...company,
        periodData: createInitialYearDataset(company.fiscalYear),
        updatedAt: new Date().toISOString(),
      };
      updateCompanyInStateAndDB(updatedComp);
      showToast(`Datos del año fiscal ${company.fiscalYear} reiniciados.`);
    }
  };

  // Admin DB: Force resync all companies into Firestore
  const handleForceResyncFirestore = async () => {
    try {
      for (const comp of companies) {
        await saveCompanyToFirestore(comp);
      }
      showToast('✓ Sincronización forzada completada en Firestore.');
    } catch (e) {
      console.error(e);
      showToast('Error en la sincronización con Firestore.');
    }
  };

  // Import backup companies array with automatic Firestore & IndexedDB synchronization
  const handleImportBackupCompanies = async (importedComps: CompanyProfile[]) => {
    if (importedComps && importedComps.length > 0) {
      try {
        for (const comp of importedComps) {
          await saveCompanyToFirestore(comp).catch((e) => console.warn('Firestore backup sync error:', e));
          await saveCompanyToDB(comp).catch((e) => console.warn('IndexedDB backup sync error:', e));
        }
        setCompanies(importedComps);

        // Find Punto Verde or company with most data to activate
        const pvComp = importedComps.find(
          (c) =>
            c.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
            c.razonSocial.toUpperCase().includes('PANIFICADORA')
        );

        if (pvComp) {
          setActiveCompanyId(pvComp.id);
          localStorage.setItem(STORAGE_ACTIVE_KEY, pvComp.id);
        } else if (!importedComps.some((c) => c.id === activeCompanyId)) {
          setActiveCompanyId(importedComps[0].id);
          localStorage.setItem(STORAGE_ACTIVE_KEY, importedComps[0].id);
        }

        showToast(`✓ Se han restaurado y sincronizado ${importedComps.length} empresas en la base de datos.`);
      } catch (err) {
        console.error('Error restoring companies backup:', err);
        showToast('Error al restaurar copia de seguridad.');
      }
    }
  };

  // Export full backup of all companies in JSON format
  const handleExportBackup = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(companies, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `backup_seniat_iva_empresas_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('✓ Copia de seguridad exportada en formato JSON.');
    } catch (e) {
      console.error(e);
      showToast('Error exportando backup JSON.');
    }
  };

  // Select company and fiscal year together (e.g. from Archive View)
  const handleSelectCompanyAndYear = (companyId: string, fiscalYear: number) => {
    setActiveCompanyId(companyId);
    localStorage.setItem(STORAGE_ACTIVE_KEY, companyId);
    const targetComp = companies.find((c) => c.id === companyId);
    if (targetComp && targetComp.fiscalYear !== fiscalYear) {
      handleUpdateCompanyInfo(targetComp.razonSocial, targetComp.rif, fiscalYear);
    }
    showToast(`Empresa activa: ${targetComp?.razonSocial || companyId} (Año ${fiscalYear})`);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-zinc-700 font-semibold text-sm">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span>Cargando base de datos multi-empresa...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col font-sans antialiased">
      {/* Top Navbar */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-zinc-950">
                  Resumen de Planillas IVA
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  SENIAT Forma 30
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Extractor inteligente de Forma 30 y generador de resumen anual (Multi-Empresa Venezuela)
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1.5 rounded-xl border border-zinc-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold ring-2 ring-emerald-500/50'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200/60'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'matrix' ? 'text-white' : 'text-emerald-600'}`} />
              <span>📊 FORMATO RESUMEN (24Q)</span>
            </button>

            <button
              onClick={() => setActiveTab('archive')}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'archive'
                  ? 'bg-zinc-900 text-white shadow-xs font-bold ring-2 ring-indigo-500/50'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200/60'
              }`}
            >
              <FolderArchive className={`w-4 h-4 ${activeTab === 'archive' ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <span>📂 ARCHIVO HISTÓRICO</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'audit'
                  ? 'bg-zinc-900 text-white shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'audit' ? 'text-pink-400' : 'text-pink-600'}`} />
              <span>Auditoría SENIAT</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'guide'
                  ? 'bg-zinc-900 text-white shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
            >
              <BookOpen className={`w-4 h-4 ${activeTab === 'guide' ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <span className="hidden sm:inline">Guía de Rubros</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Company Header Controls */}
        <CompanyHeader
          company={company}
          companies={companies}
          onSelectCompany={handleSelectCompany}
          onOpenCompanyManager={() => setIsCompanyManagerOpen(true)}
          onUpdateCompanyInfo={handleUpdateCompanyInfo}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onExportExcel={() => exportToExcel(company)}
          onExportPdf={() => exportToPdf(company)}
          onLoadDemoData={handleLoadDemoData}
          onClearYear={handleClearYear}
          selectedMonthFilter={selectedMonthFilter}
          onSelectMonthFilter={setSelectedMonthFilter}
          currentUserEmail={currentUserEmail}
          onOpenAdminModal={() => setIsAdminModalOpen(true)}
          onSignInGoogle={handleOpenAdminAccess}
        />

        {/* Tab 1: Interactive Spreadsheet Grid */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <SpreadsheetGrid
              company={company}
              onUpdateQuincena={handleUpdateQuincena}
              onOpenQuincenaModal={(data) => setInspectingQuincena(data)}
              onReconcileAll={handleReconcileAll}
              selectedMonthFilter={selectedMonthFilter}
            />
          </div>
        )}

        {/* Tab: Historical Archive of Declarations & Companies */}
        {activeTab === 'archive' && (
          <HistoryArchiveView
            companies={companies}
            activeCompanyId={activeCompanyId}
            onSelectCompanyAndYear={handleSelectCompanyAndYear}
            onOpenQuincenaModal={(data) => setInspectingQuincena(data)}
            onNavigateToMatrix={() => setActiveTab('matrix')}
            onExportExcel={(comp) => exportToExcel(comp)}
            onExportPdf={(comp) => exportToPdf(comp)}
            onImportBackup={handleImportBackupCompanies}
            onExportBackup={handleExportBackup}
          />
        )}

        {/* Tab 2: Tax Continuity & Auditor */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
              <span className="text-xs font-medium text-emerald-900">
                Estás en la vista de auditoría de <strong>{company.razonSocial}</strong>. Para ver la hoja completa con todas las quincenas del año:
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>⬅️ Volver al Formato Resumen de Planillas</span>
              </button>
            </div>
            <TaxAuditInspector
              company={company}
              onReconcileAll={handleReconcileAll}
              onOpenQuincenaModal={(data) => setInspectingQuincena(data)}
            />
          </div>
        )}

        {/* Tab 3: SENIAT Form 30 Tax Guide & Rules */}
        {activeTab === 'guide' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
              <span className="text-xs font-medium text-emerald-900">
                Estás consultando la guía técnica. Para volver a la hoja de resumen quincenal:
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>⬅️ Volver al Formato Resumen de Planillas</span>
              </button>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Guía Técnica de Rubros de la Declaración de IVA (Forma 30 SENIAT)
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Estructura de cálculo oficial conforme a la Ley del Impuesto al Valor Agregado de Venezuela y providencias administrativas del SENIAT.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Ventas & Débitos */}
                <div className="space-y-3 bg-pink-50/50 p-4 rounded-xl border border-pink-200">
                  <h4 className="font-bold text-pink-900 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-600" />
                    Débitos Fiscales y Ventas
                  </h4>
                  <ul className="space-y-2 text-zinc-700">
                    <li>
                      <strong className="text-zinc-900">Item 40 (Ventas No Gravadas / Exentas):</strong> Base imponible de ventas exentas, exoneradas o no sujetas a IVA.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 42 (Ventas Gravadas 16%):</strong> Base imponible de operaciones gravadas con la alícuota general vigente.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 47 (Total Débito Fiscal):</strong> Total de impuesto causado en ventas durante la quincena o mes.
                    </li>
                    <li className="bg-yellow-100/80 p-2 rounded border border-yellow-300 text-yellow-950 font-medium">
                      <strong>CUENTAS POR COBRAR (Fórmula):</strong> Suma de Total Ventas + Débito Fiscal (Item 47). Representa el total facturado comercialmente a clientes.
                    </li>
                  </ul>
                </div>

                {/* Compras & Créditos */}
                <div className="space-y-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                  <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Créditos Fiscales y Compras
                  </h4>
                  <ul className="space-y-2 text-zinc-700">
                    <li>
                      <strong className="text-zinc-900">Item 30 (Compras Exentas):</strong> Base de adquisiciones nacionales o servicios no gravados con IVA.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 33 / Item 34 (Compras Gravadas y Crédito 16%):</strong> Base imponible de compras gravadas al 16% y su respectivo crédito fiscal.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 333 / Item 343 (Alícuota Reducida 8%):</strong> Compras sujetas a alícuota reducida (ej. carne bovina, transporte aéreo, etc.).
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 71 (Total Créditos Deducibles):</strong> Suma de créditos deducibles directos (Item 70) más créditos por prorrateo (Item 37).
                    </li>
                  </ul>
                </div>

                {/* Excedentes & Ajustes */}
                <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
                  <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    Excedentes y Cuota Tributaria
                  </h4>
                  <ul className="space-y-2 text-zinc-700">
                    <li>
                      <strong className="text-zinc-900">Item 20 (Excedente Período Anterior):</strong> Saldo a favor no deducido en la quincena o mes inmediatamente anterior.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 39 (Total Créditos del Mes):</strong> Item 71 + Item 20 + Item 38.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 53 (Cuota Tributaria):</strong> Diferencia favorable al fisco cuando Débitos (Item 47) &gt; Créditos Totales (Item 39).
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 60 (Excedente Período Siguiente):</strong> Saldo a favor cuando Créditos &gt; Débitos, a trasladar a la próxima quincena.
                    </li>
                  </ul>
                </div>

                {/* Retenciones & Autoliquidación */}
                <div className="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-300">
                  <h4 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-600" />
                    Retenciones de IVA y Total a Pagar
                  </h4>
                  <ul className="space-y-2 text-zinc-700">
                    <li>
                      <strong className="text-zinc-900">Item 54 (Retenciones Acumuladas):</strong> Retenciones de períodos anteriores pendientes por aplicar.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 66 (Retenciones del Período):</strong> Retenciones practicadas por Agentes de Retención (Contribuyentes Especiales) durante la quincena.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 67 (Retenciones No Aplicadas):</strong> Saldo de retenciones remanentes a trasladar.
                    </li>
                    <li>
                      <strong className="text-zinc-900">Item 90 (TOTAL A PAGAR):</strong> Monto final autoliquidado a enterar en cuenta bancaria recaudadora del SENIAT.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-xl border border-zinc-700 flex items-center gap-3 text-xs animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Modal: Batch File Upload */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        currentCompany={company}
        onBatchExtracted={handleBatchExtracted}
      />

      {/* Modal: Multi-Company Manager */}
      <CompanyManagerModal
        isOpen={isCompanyManagerOpen}
        onClose={() => setIsCompanyManagerOpen(false)}
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSelectCompany={handleSelectCompany}
        onCreateCompany={handleCreateCompany}
        onUpdateCompany={handleUpdateCompany}
        onDeleteCompany={handleDeleteCompany}
        onExportExcel={(comp) => exportToExcel(comp)}
        onImportBackup={handleImportBackupCompanies}
        onExportBackup={handleExportBackup}
      />

      {/* Modal: Single Quincena Inspection / Edit */}
      <QuincenaDetailModal
        quincenaData={inspectingQuincena}
        isOpen={Boolean(inspectingQuincena)}
        onClose={() => setInspectingQuincena(null)}
        onSave={handleUpdateQuincena}
        companyName={company.razonSocial}
        rif={company.rif}
      />

      {/* Modal: Admin Database Panel (Exclusively sac1contable@gmail.com) */}
      <AdminDatabaseModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        currentUserEmail={currentUserEmail}
        companies={companies}
        onRefreshData={async () => {
          const fresh = await loadAllCompaniesFromFirestore();
          if (fresh && fresh.length > 0) setCompanies(fresh);
        }}
        onForceResync={handleForceResyncFirestore}
        onImportBackup={handleImportBackupCompanies}
        onSignOut={handleSignOut}
      />

      {/* Modal: Admin Auth Prompt */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onAuthenticated={handleAdminAuthenticated}
      />
    </div>
  );
}
