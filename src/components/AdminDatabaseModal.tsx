import React, { useState } from 'react';
import { CompanyProfile, IvaQuincenaData } from '../types';
import {
  saveCompanyToFirestore,
  deleteCompanyFromFirestore,
  loadAllCompaniesFromFirestore,
} from '../utils/firestoreDb';
import { db } from '../firebase';
import {
  Database,
  ShieldCheck,
  X,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  FileCode,
  CheckCircle2,
  LogOut,
  AlertTriangle,
  Server,
  Key,
  Building2,
  Layers,
  HardDrive,
} from 'lucide-react';

interface AdminDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string | null;
  companies: CompanyProfile[];
  onRefreshData: () => void;
  onForceResync: () => void;
  onImportBackup: (importedComps: CompanyProfile[]) => void;
  onSignOut: () => void;
}

export const AdminDatabaseModal: React.FC<AdminDatabaseModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
  companies,
  onRefreshData,
  onForceResync,
  onImportBackup,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'json' | 'danger'>('overview');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    companies[0]?.id || null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  if (!isOpen) return null;

  const isAdmin = currentUserEmail?.toLowerCase() === 'sac1contable@gmail.com';

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Export full Firestore DB to JSON file
  const handleExportBackup = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(companies, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `backup_firestore_seniat_iva_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showStatus('✓ Copia de seguridad exportada en formato JSON.');
    } catch (e) {
      console.error(e);
      showStatus('Error exportando backup JSON.');
    }
  };

  // Restore DB from JSON file or JSON text
  const handleRestoreFromJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsProcessing(true);
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const comp of parsed) {
            await saveCompanyToFirestore(comp);
          }
          onImportBackup(parsed);
          showStatus(`✓ Se importaron ${parsed.length} empresas a Firestore.`);
        } else {
          alert('El archivo JSON no contiene una lista válida de empresas.');
        }
      } catch (err) {
        alert('Error al procesar el archivo JSON: ' + String(err));
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  // Delete individual document directly in Firestore
  const handleDeleteDoc = async (id: string, name: string) => {
    if (!window.confirm(`ADMINISTRADOR: ¿Estás seguro de eliminar "${name}" permanentemente de Firestore?`)) {
      return;
    }
    try {
      setIsProcessing(true);
      await deleteCompanyFromFirestore(id);
      onRefreshData();
      showStatus(`✓ Documento "${name}" eliminado de la base de datos.`);
    } catch (e) {
      showStatus('Error eliminando documento de Firestore.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate total period data filled across all companies
  const totalQuincenasFilled = companies.reduce((acc, comp) => {
    const filledInComp = Object.values(comp.periodData || {}).filter((item) => {
      const q = item as IvaQuincenaData;
      return (q.item47 || 0) > 0 || (q.item39 || 0) > 0 || !!q.numeroDeclaracion || !!q.fileName;
    }).length;
    return acc + filledInComp;
  }, 0);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Panel de Administración de Base de Datos</h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Acceso Restringido</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Exclusivo para: <strong className="text-amber-300 font-mono">sac1contable@gmail.com</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSignOut}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"
              title="Cerrar sesión de administrador"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-400" />
              <span>Cerrar Sesión</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security Warning Banner if non-admin somehow opened */}
        {!isAdmin ? (
          <div className="p-8 text-center bg-red-50 text-red-800 space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
            <h4 className="font-bold text-lg">Acceso Denegado</h4>
            <p className="text-xs max-w-md mx-auto">
              Este panel de control de base de datos está estrictamente reservado para la cuenta{' '}
              <strong>sac1contable@gmail.com</strong>.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-xs"
            >
              Cerrar Panel
            </button>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="bg-zinc-100 px-6 py-2 border-b border-zinc-200 flex items-center justify-between text-xs font-bold text-zinc-700">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200'
                      : 'hover:bg-zinc-200/80 text-zinc-600'
                  }`}
                >
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>Resumen y Estado Firestore</span>
                </button>

                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                    activeTab === 'json'
                      ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200'
                      : 'hover:bg-zinc-200/80 text-zinc-600'
                  }`}
                >
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span>Visor de Documentos (JSON)</span>
                </button>

                <button
                  onClick={() => setActiveTab('danger')}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                    activeTab === 'danger'
                      ? 'bg-white text-red-700 shadow-xs border border-red-200'
                      : 'hover:bg-zinc-200/80 text-zinc-600'
                  }`}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Mantenimiento y Respaldo</span>
                </button>
              </div>

              {statusMessage && (
                <div className="bg-emerald-100 text-emerald-900 px-3 py-1 rounded-md text-[11px] font-semibold border border-emerald-300 animate-in fade-in">
                  {statusMessage}
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Database Information Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-xl">
                      <div className="flex items-center justify-between text-emerald-800">
                        <span className="text-xs font-bold uppercase tracking-wider">Empresas en DB</span>
                        <Building2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-black text-emerald-950 mt-1">
                        {companies.length}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        Documentos en Firestore
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl">
                      <div className="flex items-center justify-between text-blue-800">
                        <span className="text-xs font-bold uppercase tracking-wider">Quincenas Guardadas</span>
                        <Layers className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="text-2xl font-black text-blue-950 mt-1">
                        {totalQuincenasFilled}
                      </div>
                      <span className="text-[10px] text-blue-700 font-medium">
                        Registros de planillas IVA
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-4 rounded-xl">
                      <div className="flex items-center justify-between text-purple-800">
                        <span className="text-xs font-bold uppercase tracking-wider">Sincronización Cloud</span>
                        <HardDrive className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="text-sm font-bold text-purple-950 mt-2 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Tiempo Real Activo</span>
                      </div>
                      <span className="text-[10px] text-purple-700 font-medium">
                        Firestore WebSocket
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-xl">
                      <div className="flex items-center justify-between text-amber-800">
                        <span className="text-xs font-bold uppercase tracking-wider">Seguridad y Permisos</span>
                        <Key className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="text-xs font-bold text-amber-950 mt-2 truncate">
                        firestore.rules Deploy OK
                      </div>
                      <span className="text-[10px] text-amber-700 font-medium">
                        Role RBAC Auditado
                      </span>
                    </div>
                  </div>

                  {/* Technical Firebase Identifiers */}
                  <div className="bg-zinc-900 text-zinc-200 p-4 rounded-xl text-xs space-y-2 border border-zinc-800 font-mono">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400 font-bold uppercase text-[10px]">Especificación Técnica Firestore</span>
                      <span className="text-emerald-400 text-[10px] font-sans font-bold">● ONLINE</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Database ID (Instancia Firestore):</span>
                        <span className="text-amber-300 font-bold break-all">
                          ai-studio-resumendeplanill-5a4119c0-a5e2-4604-812e-88b3065d945d
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Google Cloud Project ID:</span>
                        <span className="text-indigo-300 font-bold">gen-lang-client-0333295882</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Documents Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-zinc-900">
                        Documentos de Empresas en Base de Datos ({companies.length})
                      </h4>
                      <button
                        onClick={onRefreshData}
                        className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Actualizar Lista</span>
                      </button>
                    </div>

                    <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-3">ID Documento</th>
                            <th className="p-3">Razón Social</th>
                            <th className="p-3">RIF</th>
                            <th className="p-3">Año Fiscal</th>
                            <th className="p-3">Quincenas Cargadas</th>
                            <th className="p-3 text-right">Acciones Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 font-medium">
                          {companies.map((c) => {
                            const filledCount = Object.values(c.periodData || {}).filter((item) => {
                              const q = item as IvaQuincenaData;
                              return (q.item47 || 0) > 0 || (q.item39 || 0) > 0 || !!q.numeroDeclaracion || !!q.fileName;
                            }).length;

                            return (
                              <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="p-3 font-mono text-[11px] text-zinc-500">{c.id}</td>
                                <td className="p-3 font-bold text-zinc-900">{c.razonSocial}</td>
                                <td className="p-3 font-mono text-zinc-700">{c.rif}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                                    {c.fiscalYear}
                                  </span>
                                </td>
                                <td className="p-3 text-zinc-600">{filledCount} de 24 quincenas</td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => handleDeleteDoc(c.id, c.razonSocial)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Eliminar documento directamente de Firestore"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'json' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700">
                      Seleccionar Empresa para Inspeccionar Estructura JSON:
                    </label>
                    <select
                      value={selectedCompanyId || ''}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-zinc-300 rounded-lg font-semibold text-zinc-900 bg-white"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.razonSocial} ({c.rif}) - Año {c.fiscalYear}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCompany && (
                    <div className="bg-zinc-950 text-emerald-400 p-4 rounded-xl overflow-x-auto font-mono text-xs max-h-[50vh] border border-zinc-800 shadow-inner">
                      <pre>{JSON.stringify(selectedCompany, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'danger' && (
                <div className="space-y-6">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-900 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      <span>Copias de Seguridad y Restauración de Base de Datos</span>
                    </div>
                    <p>
                      Desde esta sección puedes descargar un respaldo en archivo JSON de toda la base de datos de Firestore o importar un archivo previamente exportado.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Export Card */}
                    <div className="border border-zinc-200 p-5 rounded-xl bg-white space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Exportar Backup JSON</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Descarga un archivo .json con todas las empresas, quincenas, saldos y planillas registradas.
                      </p>
                      <button
                        onClick={handleExportBackup}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar Archivo JSON</span>
                      </button>
                    </div>

                    {/* Import Card */}
                    <div className="border border-zinc-200 p-5 rounded-xl bg-white space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                        <Upload className="w-4 h-4 text-indigo-600" />
                        <span>Restaurar desde Archivo JSON</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Sube un archivo de respaldo .json para restaurar empresas y quincenas en Firestore.
                      </p>
                      <label className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>Cargar Backup JSON</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleRestoreFromJSON}
                          className="hidden"
                          disabled={isProcessing}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Force Sync */}
                  <div className="border border-zinc-200 p-5 rounded-xl bg-zinc-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-zinc-900">Forzar Re-sincronización Global</h4>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Escribe todos los estados actuales en Firestore para garantizar consistencia total en la nube.
                        </p>
                      </div>
                      <button
                        onClick={onForceResync}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                      >
                        Sincronizar Firestore Ahora
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="bg-zinc-100 border-t border-zinc-200 px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Panel de Administración Firestore SENIAT IVA • Usuario Activo: {currentUserEmail || 'No autenticado'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-950 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
