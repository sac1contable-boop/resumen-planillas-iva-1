import React, { useState } from 'react';
import { CompanyProfile, IvaQuincenaData, MONTH_NAMES } from '../types';
import { formatCurrency, generatePeriodKey } from '../utils/taxCalculations';
import {
  FolderArchive,
  Building2,
  Calendar,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileDown,
  Upload,
  Download,
  Filter,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Receipt,
  Search,
  Sparkles,
  Layers,
} from 'lucide-react';

interface HistoryArchiveViewProps {
  companies: CompanyProfile[];
  activeCompanyId: string;
  onSelectCompanyAndYear: (companyId: string, fiscalYear: number) => void;
  onOpenQuincenaModal: (data: IvaQuincenaData) => void;
  onNavigateToMatrix: () => void;
  onExportExcel: (company: CompanyProfile) => void;
  onExportPdf: (company: CompanyProfile) => void;
  onImportBackup: (importedComps: CompanyProfile[]) => void;
  onExportBackup: () => void;
}

export const HistoryArchiveView: React.FC<HistoryArchiveViewProps> = ({
  companies,
  activeCompanyId,
  onSelectCompanyAndYear,
  onOpenQuincenaModal,
  onNavigateToMatrix,
  onExportExcel,
  onExportPdf,
  onImportBackup,
  onExportBackup,
}) => {
  const [selectedCompId, setSelectedCompId] = useState<string>(activeCompanyId || companies[0]?.id || '');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const activeCompany = companies.find((c) => c.id === selectedCompId) || companies[0];

  // Get all unique years across all companies
  const availableYears: number[] = Array.from(
    new Set<number>(
      companies.flatMap((c) => {
        const years: number[] = [Number(c.fiscalYear)];
        Object.values(c.periodData || {}).forEach((p: any) => {
          if (p.year) years.push(Number(p.year));
        });
        return years;
      })
    )
  ).sort((a, b) => b - a);

  // Extract all non-empty / loaded quincenas for a company
  const getLoadedQuincenas = (comp: CompanyProfile): IvaQuincenaData[] => {
    return (Object.values(comp.periodData || {}) as IvaQuincenaData[])
      .filter((q) => {
        const hasNumbers =
          (q.item40 || 0) > 0 ||
          (q.item42 || 0) > 0 ||
          (q.item43 || 0) > 0 ||
          (q.item30 || 0) > 0 ||
          (q.item33 || 0) > 0 ||
          (q.item34 || 0) > 0 ||
          (q.item47 || 0) > 0 ||
          (q.item71 || 0) > 0 ||
          (q.item90 || 0) > 0;
        const hasMeta = Boolean(q.numeroDeclaracion) || Boolean(q.fileName);
        const matchesYear = yearFilter === 'all' || q.year === yearFilter || comp.fiscalYear === yearFilter;
        return (hasNumbers || hasMeta) && matchesYear;
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.quincena - b.quincena;
      });
  };

  // Calculate totals for a company
  const calculateCompanyTotals = (comp: CompanyProfile) => {
    const list = getLoadedQuincenas(comp);
    return list.reduce(
      (acc, q) => ({
        totalDebito: acc.totalDebito + (q.item47 || 0),
        totalCredito: acc.totalCredito + (q.item71 || 0),
        totalPagar: acc.totalPagar + (q.item90 || 0),
        totalRetenciones: acc.totalRetenciones + (q.item66 || 0),
        count: acc.count + 1,
      }),
      { totalDebito: 0, totalCredito: 0, totalPagar: 0, totalRetenciones: 0, count: 0 }
    );
  };

  const handleOpenCompanyInFormat = (comp: CompanyProfile, targetYear?: number) => {
    const y = targetYear || comp.fiscalYear;
    onSelectCompanyAndYear(comp.id, y);
    onNavigateToMatrix();
  };

  // Restore backup file handler
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onImportBackup(parsed);
          setImportStatus(`✓ Respaldo de ${parsed.length} empresas cargado exitosamente.`);
          setTimeout(() => setImportStatus(null), 5000);
        } else {
          alert('El archivo no tiene el formato correcto de respaldo JSON.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Explanation Header */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 text-white rounded-2xl p-6 shadow-md border border-zinc-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <FolderArchive className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Archivo Histórico de Declaraciones & Respaldos Guardados
              </h2>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Permanente en Cloud
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Consulta en cualquier momento todos los períodos, años y empresas que has cargado (como <strong>Tu Punto Verde 2026</strong> o <strong>JMC Supply 2025</strong>) sin tener que descargar o subir respaldos cada vez. Todo se mantiene seguro y guardado en tu base de datos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToMatrix}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ver Formato Resumen (24Q)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Company Quick Switch Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Company Selector Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-zinc-500 shrink-0 flex items-center gap-1">
              <Building2 className="w-4 h-4 text-zinc-400" />
              <span>Empresa:</span>
            </span>
            {companies.map((c) => {
              const isSelected = c.id === selectedCompId;
              const isPuntoVerde =
                c.razonSocial.toUpperCase().includes('PUNTO VERDE') ||
                c.razonSocial.toUpperCase().includes('PANIFICADORA');
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCompId(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <span>{isPuntoVerde ? '🥖 Tu Punto Verde' : c.razonSocial}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-zinc-800 text-emerald-300' : 'bg-zinc-200 text-zinc-600'}`}>
                    {c.fiscalYear}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs font-bold text-zinc-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>Año:</span>
            </span>
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setYearFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  yearFilter === 'all' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Todos
              </button>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setYearFilter(yr)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    yearFilter === yr ? 'bg-emerald-600 text-white shadow-2xs font-black' : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Company Details Card */}
      {activeCompany && (() => {
        const totals = calculateCompanyTotals(activeCompany);
        const loadedQuincenas = getLoadedQuincenas(activeCompany);

        return (
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Header of the Selected Company */}
            <div className="p-5 bg-zinc-50 border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-emerald-600/10 text-emerald-700 rounded-xl border border-emerald-500/20 shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-zinc-950">
                      {activeCompany.razonSocial}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-200 text-zinc-800">
                      RIF: {activeCompany.rif}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Año Fiscal Principal: {activeCompany.fiscalYear}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {loadedQuincenas.length > 0
                      ? `Contiene ${loadedQuincenas.length} quincenas con datos y planillas guardadas.`
                      : 'Esta empresa tiene su formato en blanco listo para comenzar a cargar planillas.'}
                  </p>
                </div>
              </div>

              {/* Direct Open in Format Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenCompanyInFormat(activeCompany)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all ring-2 ring-emerald-500/30"
                  title="Abre esta empresa y año en la tabla anual principal"
                >
                  <span>📊 Abrir y Trabajar en Formato (Año {activeCompany.fiscalYear})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onExportExcel(activeCompany)}
                  className="p-2 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 rounded-lg transition-colors border border-zinc-300 bg-white"
                  title="Descargar libro Excel de esta empresa"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                </button>

                <button
                  type="button"
                  onClick={() => onExportPdf(activeCompany)}
                  className="p-2 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 rounded-lg transition-colors border border-zinc-300 bg-white"
                  title="Exportar PDF de esta empresa"
                >
                  <FileDown className="w-4 h-4 text-rose-600" />
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="p-6 border-b border-zinc-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
                <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <span>Débito Fiscal Acumulado</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-black text-emerald-950 mt-1 font-mono">
                  {formatCurrency(totals.totalDebito)}
                </div>
                <span className="text-[10px] text-emerald-700 font-medium">Rubro 47 (SENIAT)</span>
              </div>

              <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl">
                <div className="flex items-center justify-between text-blue-800 text-xs font-bold uppercase tracking-wider">
                  <span>Crédito Fiscal Acumulado</span>
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl font-black text-blue-950 mt-1 font-mono">
                  {formatCurrency(totals.totalCredito)}
                </div>
                <span className="text-[10px] text-blue-700 font-medium">Rubro 71 (SENIAT)</span>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl">
                <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <span>Total Pagado al SENIAT</span>
                  <Receipt className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-black text-amber-950 mt-1 font-mono">
                  {formatCurrency(totals.totalPagar)}
                </div>
                <span className="text-[10px] text-amber-700 font-medium">Rubro 90 (SENIAT)</span>
              </div>

              <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-xl">
                <div className="flex items-center justify-between text-purple-800 text-xs font-bold uppercase tracking-wider">
                  <span>Quincenas con Datos</span>
                  <Layers className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-xl font-black text-purple-950 mt-1">
                  {loadedQuincenas.length} de 24
                </div>
                <span className="text-[10px] text-purple-700 font-medium">Períodos registrados</span>
              </div>
            </div>

            {/* List of Registered Quincenas Table */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Detalle de Declaraciones y Planillas Guardadas</span>
                </h4>
                <span className="text-xs text-zinc-500">
                  {loadedQuincenas.length} registro(s) encontrado(s)
                </span>
              </div>

              {loadedQuincenas.length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <p className="text-xs text-zinc-500 font-medium">
                    No hay planillas registradas en este año o filtro para esta empresa.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenCompanyInFormat(activeCompany)}
                    className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5"
                  >
                    <span>Abrir Formato y Comenzar a Cargar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                      <tr>
                        <th className="py-2.5 px-3">Período / Quincena</th>
                        <th className="py-2.5 px-3">Archivo PDF Asociado</th>
                        <th className="py-2.5 px-3">N° Declaración</th>
                        <th className="py-2.5 px-3 text-right">Ventas Gravadas (Item 42)</th>
                        <th className="py-2.5 px-3 text-right">Débito Fiscal (Item 47)</th>
                        <th className="py-2.5 px-3 text-right">Crédito Fiscal (Item 71)</th>
                        <th className="py-2.5 px-3 text-right">A Pagar (Item 90)</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {loadedQuincenas.map((q) => {
                        const monthName = MONTH_NAMES[q.month - 1] || `Mes ${q.month}`;
                        return (
                          <tr key={q.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="py-3 px-3 font-semibold text-zinc-950">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>{q.quincena === 1 ? '1ra Q' : '2da Q'} {monthName} {q.year}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              {q.fileName ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 font-mono text-[11px] border border-zinc-300 max-w-xs truncate" title={q.fileName}>
                                  <FileText className="w-3 h-3 text-red-500 shrink-0" />
                                  <span className="truncate">{q.fileName}</span>
                                </span>
                              ) : (
                                <span className="text-zinc-400 italic text-[11px]">Carga manual</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-zinc-700">
                              {q.numeroDeclaracion || '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-zinc-800">
                              {formatCurrency(q.item42)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-800">
                              {formatCurrency(q.item47)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-blue-800">
                              {formatCurrency(q.item71)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-amber-900">
                              {formatCurrency(q.item90)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => onOpenQuincenaModal(q)}
                                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-[11px] rounded border border-zinc-300 inline-flex items-center gap-1 transition-colors"
                                title="Ver todas las casillas y detalles de esta quincena"
                              >
                                <Eye className="w-3.5 h-3.5 text-zinc-600" />
                                <span>Ver Casillas</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Backup Quick Sync Footer Card */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-xs text-zinc-900 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Respaldo y Copia de Seguridad Local (Opcional)</span>
            </h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Tus datos ya están guardados permanentemente en la app. Si deseas guardar una copia offline en tu computadora o importar otro archivo:
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Archivo Respaldo (.json)</span>
              <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            </label>

            <button
              type="button"
              onClick={onExportBackup}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-950 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Descargar Copia (.json)</span>
            </button>
          </div>
        </div>

        {importStatus && (
          <div className="bg-emerald-100 text-emerald-900 p-2.5 rounded-lg text-xs font-semibold border border-emerald-300">
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
};
