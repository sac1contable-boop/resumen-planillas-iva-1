import React, { useState } from 'react';
import { CompanyProfile, IvaQuincenaData, MONTH_NAMES } from '../types';
import { hasDemoOrSimulatorData } from '../utils/taxCalculations';
import {
  Building2,
  FileSpreadsheet,
  FileDown,
  Upload,
  Sparkles,
  Calendar,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Database,
  FolderArchive,
} from 'lucide-react';

interface CompanyHeaderProps {
  company: CompanyProfile;
  companies: CompanyProfile[];
  onSelectCompany: (id: string) => void;
  onOpenCompanyManager: () => void;
  onUpdateCompanyInfo: (razonSocial: string, rif: string, fiscalYear: number) => void;
  onOpenUploadModal: () => void;
  activeTab?: 'matrix' | 'archive' | 'audit' | 'guide';
  onSelectTab?: (tab: 'matrix' | 'archive' | 'audit' | 'guide') => void;
  onExportExcel: () => Promise<void> | void;
  onExportPdf: () => void;
  onLoadDemoData: () => void;
  onClearYear: () => void;
  selectedMonthFilter: number | null;
  onSelectMonthFilter: (m: number | null) => void;
  currentUserEmail?: string | null;
  onOpenAdminModal?: () => void;
  onSignInGoogle?: () => void;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  company,
  companies,
  onSelectCompany,
  onOpenCompanyManager,
  onUpdateCompanyInfo,
  onOpenUploadModal,
  activeTab = 'matrix',
  onSelectTab,
  onExportExcel,
  onExportPdf,
  onLoadDemoData,
  onClearYear,
  selectedMonthFilter,
  onSelectMonthFilter,
  currentUserEmail,
  onOpenAdminModal,
  onSignInGoogle,
}) => {
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [razonSocial, setRazonSocial] = useState(company.razonSocial);
  const [rif, setRif] = useState(company.rif);
  const [fiscalYear, setFiscalYear] = useState(company.fiscalYear);

  React.useEffect(() => {
    setRazonSocial(company.razonSocial);
    setRif(company.rif);
    setFiscalYear(company.fiscalYear);
  }, [company.razonSocial, company.rif, company.fiscalYear]);

  const handleSaveInfo = () => {
    onUpdateCompanyInfo(razonSocial, rif, fiscalYear);
    setIsEditingInfo(false);
  };

  const handleExportExcelWithLoading = async () => {
    try {
      setIsGeneratingExcel(true);
      await onExportExcel();
    } catch (e) {
      console.error('Error generando Excel:', e);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  return (
    <div className="w-full bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-4">
      {/* Top row: Company identification & main action buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Company Title info with Multi-Company Selector */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-600/10 text-emerald-700 rounded-xl border border-emerald-500/20 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            {isEditingInfo ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <input
                  type="text"
                  className="px-2.5 py-1 text-xs border border-zinc-300 rounded font-semibold text-zinc-900 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Razón Social"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                />
                <input
                  type="text"
                  className="px-2.5 py-1 text-xs border border-zinc-300 rounded font-mono text-zinc-900 focus:ring-1 focus:ring-emerald-500 w-32"
                  placeholder="RIF (ej. J-411499455)"
                  value={rif}
                  onChange={(e) => setRif(e.target.value)}
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-zinc-500">Año:</span>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-xs border border-zinc-300 rounded font-bold text-emerald-900 focus:ring-1 focus:ring-emerald-500"
                    placeholder="Año"
                  />
                </div>
                <button
                  onClick={handleSaveInfo}
                  className="p-1 text-emerald-700 hover:text-emerald-900 bg-emerald-100 rounded"
                  title="Guardar datos"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Company Select Dropdown */}
                {companies.length > 1 ? (
                  <select
                    value={company.id}
                    onChange={(e) => onSelectCompany(e.target.value)}
                    className="text-base font-bold text-zinc-900 tracking-tight bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 rounded-lg px-2.5 py-1 cursor-pointer focus:ring-2 focus:ring-emerald-500 max-w-xs sm:max-w-md truncate"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razonSocial} ({c.rif}) - Año {c.fiscalYear}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h1 className="text-base font-bold text-zinc-900 tracking-tight">
                    {company.razonSocial}
                  </h1>
                )}

                <button
                  onClick={() => {
                    setRazonSocial(company.razonSocial);
                    setRif(company.rif);
                    setFiscalYear(company.fiscalYear);
                    setIsEditingInfo(true);
                  }}
                  className="text-zinc-400 hover:text-zinc-700 p-0.5"
                  title="Editar nombre y RIF de esta empresa"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onOpenCompanyManager}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-950 text-white font-bold text-[11px] rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors ml-1"
                  title="Gestión de Empresas (Crear, cambiar o administrar múltiples empresas)"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>🏢 Multi-Empresa ({companies.length})</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
              <span className="font-mono font-medium text-zinc-700">RIF: {company.rif}</span>
              <span>•</span>
              <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="font-bold text-emerald-800">Ejercicio Fiscal:</span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={company.fiscalYear}
                  onChange={(e) => {
                    const newY = Number(e.target.value);
                    if (newY >= 2000 && newY <= 2100) {
                      onUpdateCompanyInfo(company.razonSocial, company.rif, newY);
                    }
                  }}
                  className="w-16 px-1 py-0 text-xs font-black text-emerald-900 bg-white border border-emerald-300 rounded text-center focus:ring-1 focus:ring-emerald-500"
                  title="Escriba o cambie cualquier año fiscal (2020, 2024, 2025, 2026, 2027, 2028, etc.)"
                />
              </div>
              <span>•</span>
              <span className="text-zinc-500">24 Períodos (Quincenal SENIAT)</span>
              <span>•</span>
              {(() => {
                const isDemo = hasDemoOrSimulatorData(company.periodData);
                const hasRegisteredData = (Object.values(company.periodData || {}) as IvaQuincenaData[]).some(
                  (p: IvaQuincenaData) => (p.item40 || 0) > 0 || (p.item30 || 0) > 0 || Boolean(p.numeroDeclaracion)
                );
                if (isDemo) {
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-100 text-pink-800 border border-pink-300">
                      <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                      Simulación Demo Activa
                    </span>
                  );
                }
                if (!hasRegisteredData) {
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ✨ Formato Limpio (0s) • Listo para Cargar
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    Datos Reales Registrados
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ADMIN DATABASE PANEL BUTTON - ONLY FOR sac1contable@gmail.com */}
          {currentUserEmail?.toLowerCase() === 'sac1contable@gmail.com' ? (
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs rounded-lg shadow-sm flex items-center gap-1.5 border border-amber-400 transition-colors"
              title="Panel de Control de Base de Datos (Exclusivo sac1contable@gmail.com)"
            >
              <ShieldCheck className="w-4 h-4 text-zinc-950" />
              <span>🔑 Panel DB Admin</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignInGoogle}
              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors border border-zinc-300"
              title="Acceso de Administrador a la Base de Datos"
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>{currentUserEmail ? currentUserEmail : 'Acceso Admin DB'}</span>
            </button>
          )}

          {onSelectTab && (
            <>
              <button
                type="button"
                onClick={() => onSelectTab('matrix')}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-md transition-all ${
                  activeTab === 'matrix'
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white ring-2 ring-emerald-400/60'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white'
                }`}
                title="Ver el Formato de Resumen de Planillas IVA (Quincena por Quincena - 24 Períodos)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>📊 FORMATO RESUMEN (24Q)</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('archive')}
                className={`px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all border ${
                  activeTab === 'archive'
                    ? 'bg-zinc-900 text-white border-zinc-800 shadow-sm'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                }`}
                title="Ver todas las empresas y declaraciones guardadas en el archivo permanente sin cargar archivos"
              >
                <FolderArchive className={`w-4 h-4 ${activeTab === 'archive' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <span>📂 Archivo Histórico</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenUploadModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Subir Planillas (PDF)</span>
          </button>

          <button
            type="button"
            disabled={isGeneratingExcel}
            onClick={handleExportExcelWithLoading}
            className={`px-3.5 py-2 text-white rounded-lg font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors ${
              isGeneratingExcel
                ? 'bg-zinc-600 cursor-not-allowed opacity-80'
                : 'bg-zinc-800 hover:bg-zinc-900'
            }`}
            title="Descargar libro de cálculo Excel con 4 hojas profesionales (Portada, Matriz Anual, Detalle y Validación)"
          >
            <FileSpreadsheet className={`w-4 h-4 ${isGeneratingExcel ? 'animate-spin text-amber-300' : 'text-emerald-400'}`} />
            <span>{isGeneratingExcel ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={onExportPdf}
            className="px-3 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors"
            title="Exportar informe en formato PDF"
          >
            <FileDown className="w-4 h-4 text-pink-600" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={onLoadDemoData}
            className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors"
            title="Cargar datos de ejemplo en esta empresa"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-600" />
            <span>Datos Demo</span>
          </button>

          <button
            type="button"
            onClick={onClearYear}
            className="px-2.5 py-2 text-zinc-600 hover:text-red-700 hover:bg-red-50 border border-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Limpiar todas las quincenas del año y dejar en formato limpio (0s)"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Limpiar Formato (0s)</span>
          </button>
        </div>
      </div>

      {/* Month Filter Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-zinc-100 pt-3">
        <span className="text-zinc-500 font-semibold text-[11px] shrink-0 mr-1">
          Filtrar Mes:
        </span>
        <button
          onClick={() => onSelectMonthFilter(null)}
          className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors shrink-0 ${
            selectedMonthFilter === null
              ? 'bg-zinc-900 text-white font-bold'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          Todo el Año (24 Quincenas)
        </button>

        {MONTH_NAMES.map((monthName, idx) => {
          const monthNum = idx + 1;
          const isSelected = selectedMonthFilter === monthNum;
          return (
            <button
              key={`filter-${monthNum}`}
              onClick={() => onSelectMonthFilter(isSelected ? null : monthNum)}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors shrink-0 ${
                isSelected
                  ? 'bg-pink-600 text-white font-bold'
                  : 'bg-pink-50/80 hover:bg-pink-100 text-pink-900 border border-pink-100'
              }`}
            >
              {monthName.substring(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

