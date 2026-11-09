import React, { useState } from 'react';
import { CompanyProfile } from '../types';
import { createInitialYearDataset, createDemoDataset, auditPeriodHealth } from '../utils/taxCalculations';
import {
  Building2,
  Plus,
  Check,
  Search,
  Trash2,
  Edit3,
  FileSpreadsheet,
  X,
  Copy,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Upload,
  Download,
} from 'lucide-react';

interface CompanyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyProfile[];
  activeCompanyId: string;
  onSelectCompany: (id: string) => void;
  onCreateCompany: (newCompany: CompanyProfile) => void;
  onUpdateCompany: (company: CompanyProfile) => void;
  onDeleteCompany: (id: string) => void;
  onExportExcel: (company: CompanyProfile) => void;
  onImportBackup?: (importedComps: CompanyProfile[]) => void;
  onExportBackup?: () => void;
}

export const CompanyManagerModal: React.FC<CompanyManagerModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  onSelectCompany,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
  onExportExcel,
  onImportBackup,
  onExportBackup,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // Handle restoring backup from JSON file
  const handleRestoreJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (onImportBackup) {
            onImportBackup(parsed);
            setRestoreStatus(`✓ ¡Respaldo cargado con éxito! Se restauraron ${parsed.length} empresas.`);
            setTimeout(() => setRestoreStatus(null), 5000);
          }
        } else {
          alert('El archivo no contiene un formato de lista de empresas válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // New company form state
  const [newRazonSocial, setNewRazonSocial] = useState('');
  const [newRif, setNewRif] = useState('');
  const [newFiscalYear, setNewFiscalYear] = useState(2025);
  const [loadDemo, setLoadDemo] = useState(false);

  // Editing company state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRazonSocial, setEditRazonSocial] = useState('');
  const [editRif, setEditRif] = useState('');
  const [editYear, setEditYear] = useState(2025);

  if (!isOpen) return null;

  const filteredCompanies = companies.filter(
    (c) =>
      c.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.rif.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRazonSocial.trim()) return;

    const compId = `company-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const isPuntoVerde =
      newRazonSocial.toUpperCase().includes('PUNTO VERDE') ||
      newRazonSocial.toUpperCase().includes('PANIFICADORA');

    let initialPeriodData = createInitialYearDataset(newFiscalYear);

    if (loadDemo && !isPuntoVerde) {
      const demo = createDemoDataset(newFiscalYear);
      initialPeriodData = demo.periodData;
    }

    const created: CompanyProfile = {
      id: compId,
      razonSocial: newRazonSocial.trim().toUpperCase(),
      rif: newRif.trim().toUpperCase() || 'J-000000000',
      fiscalYear: newFiscalYear,
      periodData: initialPeriodData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreateCompany(created);
    setNewRazonSocial('');
    setNewRif('');
    setIsCreatingNew(false);
  };

  const handleStartEdit = (c: CompanyProfile) => {
    setEditingId(c.id);
    setEditRazonSocial(c.razonSocial);
    setEditRif(c.rif);
    setEditYear(c.fiscalYear);
  };

  const handleSaveEdit = (c: CompanyProfile) => {
    const updated: CompanyProfile = {
      ...c,
      razonSocial: editRazonSocial.trim().toUpperCase(),
      rif: editRif.trim().toUpperCase(),
      fiscalYear: editYear,
      updatedAt: new Date().toISOString(),
    };
    onUpdateCompany(updated);
    setEditingId(null);
  };

  const handleDuplicate = (c: CompanyProfile) => {
    const targetYear = c.fiscalYear + 1;
    const duplicatedId = `company-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const duplicated: CompanyProfile = {
      ...c,
      id: duplicatedId,
      razonSocial: `${c.razonSocial}`,
      fiscalYear: targetYear,
      periodData: createInitialYearDataset(targetYear),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onCreateCompany(duplicated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/30 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Gestión de Empresas Contribuyentes</h3>
              <p className="text-xs text-zinc-400">
                Selecciona, crea o administra cualquier empresa de Venezuela para procesar su IVA anual (Forma 30)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o RIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-zinc-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Direct Restore Backup Button */}
            <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer" title="Carga tu archivo de respaldo .json para restaurar todas tus empresas y datos">
              <Upload className="w-3.5 h-3.5" />
              <span>📥 Cargar Respaldo JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreJsonFile}
                className="hidden"
              />
            </label>

            {/* Export Backup Button */}
            {onExportBackup && (
              <button
                type="button"
                onClick={onExportBackup}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-900 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                title="Descargar copia de seguridad en JSON de todas las empresas"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>📤 Exportar Backup</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreatingNew ? 'Cancelar' : 'Nueva Empresa'}</span>
            </button>
          </div>
        </div>

        {/* Restore Status Alert */}
        {restoreStatus && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{restoreStatus}</span>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Create New Company Card */}
          {isCreatingNew && (
            <form
              onSubmit={handleCreateSubmit}
              className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-xl space-y-4 shadow-2xs animate-in slide-in-from-top-3"
            >
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm border-b border-emerald-200 pb-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Formulario de Registro de Nueva Empresa</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Razón Social / Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. COMERCIAL VENEZUELA, C.A."
                    value={newRazonSocial}
                    onChange={(e) => setNewRazonSocial(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg font-semibold text-zinc-900 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    RIF (Registro de Información Fiscal) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. J-501928374"
                    value={newRif}
                    onChange={(e) => setNewRif(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg font-mono font-medium text-zinc-900 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Año Fiscal Inicial</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={newFiscalYear}
                    onChange={(e) => setNewFiscalYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg font-bold text-emerald-900 focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ej. 2025"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loadDemo}
                    onChange={(e) => setLoadDemo(e.target.checked)}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Inicializar con datos de demostración pre-cargados (Planillas de prueba)</span>
                </label>

                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar y Activar Empresa</span>
                </button>
              </div>
            </form>
          )}

          {/* Companies Grid */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Empresas Registradas ({filteredCompanies.length})</span>
              <span className="text-zinc-400 font-normal">Haz clic en &quot;Activar&quot; para trabajar en su resumen</span>
            </div>

            {filteredCompanies.length === 0 ? (
              <div className="text-center py-10 bg-zinc-50 border border-dashed border-zinc-300 rounded-xl">
                <Building2 className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-600">No se encontraron empresas coincidentes.</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Haz clic en &quot;Registrar Nueva Empresa&quot; para crear una nueva matriz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredCompanies.map((c) => {
                  const isActive = c.id === activeCompanyId;
                  const audit = auditPeriodHealth(c.fiscalYear, c.periodData || {});
                  const isEditing = editingId === c.id;

                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-emerald-50/50 border-emerald-400 shadow-xs ring-1 ring-emerald-400/50'
                          : 'bg-white border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">
                                Razón Social
                              </label>
                              <input
                                type="text"
                                value={editRazonSocial}
                                onChange={(e) => setEditRazonSocial(e.target.value)}
                                className="w-full px-2.5 py-1 border border-zinc-300 rounded font-semibold text-zinc-900"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">RIF</label>
                              <input
                                type="text"
                                value={editRif}
                                onChange={(e) => setEditRif(e.target.value)}
                                className="w-full px-2.5 py-1 border border-zinc-300 rounded font-mono text-zinc-900"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 block mb-0.5">
                                Año Fiscal
                              </label>
                              <input
                                type="number"
                                min={2000}
                                max={2100}
                                value={editYear}
                                onChange={(e) => setEditYear(Number(e.target.value))}
                                className="w-full px-2.5 py-1 border border-zinc-300 rounded font-bold text-emerald-900 focus:ring-1 focus:ring-emerald-500 text-xs"
                                placeholder="Ej. 2025"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 rounded"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(c)}
                              className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                              Guardar Cambios
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`p-2.5 rounded-xl border shrink-0 ${
                                isActive
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                              }`}
                            >
                              <Building2 className="w-5 h-5" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-zinc-950 truncate">
                                  {c.razonSocial}
                                </h4>
                                {isActive && (
                                  <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Empresa Activa
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
                                <span className="font-mono font-semibold text-zinc-800">
                                  RIF: {c.rif}
                                </span>
                                <span>•</span>
                                <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                                  Año {c.fiscalYear}
                                </span>
                                <span>•</span>
                                <span className="text-zinc-600">
                                  {audit.totalPeriodsWithData} de 24 quincenas cargadas
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Company Actions */}
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectCompany(c.id);
                                  onClose();
                                }}
                                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-950 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                              >
                                <span>Activar</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartEdit(c)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                              title="Editar nombre, RIF o año fiscal"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicate(c)}
                              className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Crear matriz para el año siguiente de esta empresa"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onExportExcel(c)}
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Exportar Excel de esta empresa"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={companies.length <= 1}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Estás seguro de eliminar la empresa "${c.razonSocial}"?`
                                  )
                                ) {
                                  onDeleteCompany(c.id);
                                }
                              }}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                              title="Eliminar empresa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            <span>
              Total de empresas en base de datos local: <strong>{companies.length}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-950 rounded-lg shadow-xs transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
