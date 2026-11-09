import React, { useState, useRef } from 'react';
import { CompanyProfile, ExtractionResult, IvaQuincenaData, MONTH_NAMES } from '../types';
import { formatCurrency, generatePeriodKey, detectPeriodFromFilename } from '../utils/taxCalculations';
import { extractIvaFromPdfClient } from '../utils/clientPdfParser';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Layers,
  Check,
  Calendar,
  Building,
} from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompany: CompanyProfile;
  onBatchExtracted: (
    results: {
      quincenaData: IvaQuincenaData;
      razonSocial?: string;
      rif?: string;
      fiscalYear?: number;
    }[]
  ) => void;
}

interface UploadTask {
  id: string;
  file: File;
  status: 'idle' | 'processing' | 'success' | 'error';
  progress: number;
  assignedYear: number;
  assignedMonth: number;
  assignedQuincena: 1 | 2;
  result?: ExtractionResult['data'];
  error?: string;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  currentCompany,
  onBatchExtracted,
}) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesAdded = (files: FileList | File[]) => {
    const newTasks: UploadTask[] = Array.from(files).map((file) => {
      const detected = detectPeriodFromFilename(file.name);
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        file,
        status: 'idle',
        progress: 0,
        assignedYear: detected.year || currentCompany.fiscalYear,
        assignedMonth: detected.month || 1,
        assignedQuincena: detected.quincena || 1,
      };
    });

    setTasks((prev) => [...prev, ...newTasks]);
  };

  const handleUpdateTaskPeriod = (
    taskId: string,
    updates: { month?: number; quincena?: 1 | 2; year?: number }
  ) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const newYear = updates.year ?? t.assignedYear;
        const newMonth = updates.month ?? t.assignedMonth;
        const newQuincena = updates.quincena ?? t.assignedQuincena;
        const updatedTask: UploadTask = {
          ...t,
          assignedYear: newYear,
          assignedMonth: newMonth,
          assignedQuincena: newQuincena,
        };

        if (t.result) {
          updatedTask.result = {
            ...t.result,
            fiscalYear: newYear,
            month: newMonth,
            quincena: newQuincena,
          };

        }

        return updatedTask;
      })
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processSingleTask = async (task: UploadTask): Promise<ExtractionResult['data'] | null> => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'processing', progress: 30 } : t))
      );

      let extractedData: ExtractionResult['data'] | null = null;

      // Check if running on local dev server with Express API
      const isLocalServer = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      // Intent 1: Try server endpoint ONLY if on local dev server with active backend
      if (isLocalServer) {
        try {
          const base64Data = await fileToBase64(task.file);
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, progress: 50 } : t))
          );

          const response = await fetch('/api/extract-iva', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: task.file.type || 'application/pdf',
              fileName: task.file.name,
              preferredPeriod: {
                year: task.assignedYear,
                month: task.assignedMonth,
                quincena: task.assignedQuincena,
              },
            }),
          });

          if (response.ok) {
            const resData = await response.json().catch(() => ({}));
            if (resData.success && resData.data) {
              extractedData = resData.data;
            }
          }
        } catch {
          // Fall through to client extractor
        }
      }

      // Intent 2: In-browser client-side extraction (100% functional on Netlify, GitHub Pages, or offline)
      if (!extractedData) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, progress: 75 } : t))
        );

        extractedData = await extractIvaFromPdfClient(task.file, {
          year: task.assignedYear,
          month: task.assignedMonth,
          quincena: task.assignedQuincena,
        });
      }

      if (!extractedData) {
        throw new Error('No se pudieron extraer datos del archivo.');
      }

      const finalResultData = {
        ...extractedData,
        fiscalYear: extractedData.fiscalYear || task.assignedYear,
        month: extractedData.month || task.assignedMonth,
        quincena: extractedData.quincena || task.assignedQuincena,
      };

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'success',
                progress: 100,
                assignedYear: finalResultData.fiscalYear,
                assignedMonth: finalResultData.month,
                assignedQuincena: finalResultData.quincena,
                result: finalResultData,
              }
            : t
        )
      );

      return finalResultData;
    } catch (err: any) {
      console.error('Error processing task:', err);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: 'error', progress: 0, error: err.message || 'Error al procesar archivo' }
            : t
        )
      );
      return null;
    }
  };

  const handleStartBatchExtraction = async () => {
    const idleTasks = tasks.filter((t) => t.status === 'idle' || t.status === 'error');
    if (idleTasks.length === 0) return;

    setIsProcessingAll(true);
    const extractedResults: {
      quincenaData: IvaQuincenaData;
      razonSocial?: string;
      rif?: string;
      fiscalYear?: number;
    }[] = [];

    // Process tasks in fast parallel batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < idleTasks.length; i += BATCH_SIZE) {
      const chunk = idleTasks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(chunk.map((task) => processSingleTask(task)));

      results.forEach((extracted) => {
        if (extracted) {
          const yr = extracted.fiscalYear || currentCompany.fiscalYear;
          const mo = extracted.month || 1;
          const qu = extracted.quincena || 1;
          const pKey = generatePeriodKey(yr, mo, qu);

          const qData: IvaQuincenaData = {
            id: pKey,
            year: yr,
            month: mo,
            quincena: qu,
            fileName: extracted.fileName || 'Planilla.pdf',
            numeroDeclaracion: extracted.numeroDeclaracion || '',
            numeroCertificado: extracted.numeroCertificado || '',
            fechaDeclaracion: extracted.fechaDeclaracion || '',
            fechaDesde: extracted.fechaDesde || '',
            fechaHasta: extracted.fechaHasta || '',

            item40: extracted.item40 || 0,
            item41: extracted.item41 || 0,
            item42: extracted.item42 || 0,
            item43: extracted.item43 || 0,
            item442: extracted.item442 || 0,
            item443: extracted.item443 || 0,
            ingresoIntereses: extracted.ingresoIntereses || 0,
            item47: extracted.item47 || 0,

            item30: extracted.item30 || 0,
            item31: extracted.item31 || 0,
            item33: extracted.item33 || 0,
            item34: extracted.item34 || 0,
            item333: extracted.item333 || 0,
            item343: extracted.item343 || 0,
            item35: extracted.item35 || 0,
            item70: extracted.item70 || 0,
            item37: extracted.item37 || 0,
            item71: extracted.item71 || 0,

            item20: extracted.item20 || 0,
            item38: extracted.item38 || 0,
            item39: extracted.item39 || 0,
            item53: extracted.item53 || 0,

            item60: extracted.item60 || 0,
            item54: extracted.item54 || 0,
            item66: extracted.item66 || 0,
            item67: extracted.item67 || 0,
            item90: extracted.item90 || 0,
          };

          extractedResults.push({
            quincenaData: qData,
            razonSocial: extracted.razonSocial,
            rif: extracted.rif,
            fiscalYear: extracted.fiscalYear,
          });
        }
      });
    }

    setIsProcessingAll(false);

    if (extractedResults.length > 0) {
      setTimeout(() => {
        onBatchExtracted(extractedResults);
      }, 50);
    }
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'success'));
  };

  const successCount = tasks.filter((t) => t.status === 'success').length;
  const idleCount = tasks.filter((t) => t.status === 'idle' || t.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/30 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Carga y Extracción Inteligente de Planillas IVA</h3>
              <p className="text-xs text-zinc-400">
                Extrae los montos de tus planillas SENIAT (Forma 30 y Certificados) y llena el resumen anual automáticamente
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Drag and Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesAdded(e.target.files);
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <Upload className="w-5 h-5" />
              </div>
              <div className="font-semibold text-zinc-800 text-sm">
                Arrastra aquí tus archivos PDF de IVA o haz clic para seleccionarlos
              </div>
              <p className="text-xs text-zinc-500 max-w-md">
                Soporta Formas 30 y Certificados Electrónicos de Declaración de IVA. Puedes subir las 24 quincenas del año simultáneamente.
              </p>
            </div>
          </div>

          {/* Files List / Processing Queue */}
          {tasks.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 px-1">
                <span>Archivos seleccionados ({tasks.length})</span>
                {successCount > 0 && (
                  <button
                    onClick={handleClearCompleted}
                    className="text-zinc-500 hover:text-zinc-800 text-[11px] underline"
                  >
                    Limpiar completados
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-xl border text-xs transition-colors ${
                      task.status === 'success'
                        ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                        : task.status === 'error'
                        ? 'bg-red-50/70 border-red-200 text-red-900'
                        : task.status === 'processing'
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                        : 'bg-white border-zinc-200 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileText className="w-4 h-4 shrink-0 text-zinc-500" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-zinc-900">{task.file.name}</div>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                            <span>{(task.file.size / 1024).toFixed(1)} KB</span>
                            {task.error && (
                              <span className="text-red-600 truncate">{task.error}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {task.status === 'processing' && (
                          <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-[11px]">Extrayendo montos...</span>
                          </div>
                        )}
                        {task.status === 'success' && (
                          <div className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Montos Extraídos</span>
                          </div>
                        )}
                        {task.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-600 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Error</span>
                          </div>
                        )}

                        {!isProcessingAll && (
                          <button
                            onClick={() => handleRemoveTask(task.id)}
                            className="text-zinc-400 hover:text-zinc-700 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Period Assignment Selector (Accessible before and after extraction) */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-200/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-[11px] font-semibold text-zinc-700">Período:</span>
                        <select
                          value={task.assignedMonth}
                          disabled={task.status === 'processing'}
                          onChange={(e) =>
                            handleUpdateTaskPeriod(task.id, { month: parseInt(e.target.value, 10) })
                          }
                          className="bg-white border border-zinc-300 text-zinc-900 text-[11px] font-semibold rounded px-2 py-0.5 shadow-2xs hover:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          {MONTH_NAMES.map((mName, mIdx) => (
                            <option key={mIdx + 1} value={mIdx + 1}>
                              {mName}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] font-semibold text-zinc-600">{task.assignedYear}</span>
                      </div>

                      <div className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5 shadow-2xs">
                        <button
                          type="button"
                          disabled={task.status === 'processing'}
                          onClick={() => handleUpdateTaskPeriod(task.id, { quincena: 1 })}
                          className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                            task.assignedQuincena === 1
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          1ra Quincena (01-15)
                        </button>
                        <button
                          type="button"
                          disabled={task.status === 'processing'}
                          onClick={() => handleUpdateTaskPeriod(task.id, { quincena: 2 })}
                          className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                            task.assignedQuincena === 2
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          2da Quincena (16-fin)
                        </button>
                      </div>
                    </div>

                    {/* Extracted Data Card Preview */}
                    {task.result && (
                      <div className="mt-2.5 pt-2.5 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white/70 p-2.5 rounded-lg">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Período Asignado</span>
                          <span className="font-bold text-zinc-900">
                            {task.result.fiscalYear} {task.result.month ? MONTH_NAMES[task.result.month - 1] : 'Mes'} ({task.result.quincena === 1 ? '1ra Q' : '2da Q'})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Ventas No Gravadas (40)</span>
                          <span className="font-mono font-medium text-zinc-800">
                            Bs. {formatCurrency(task.result.item40)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Ventas Gravadas (42)</span>
                          <span className="font-mono font-medium text-zinc-800">
                            Bs. {formatCurrency(task.result.item42)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Total Débito Fiscal (47)</span>
                          <span className="font-mono font-bold text-emerald-800">
                            Bs. {formatCurrency(task.result.item47)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Total Compras (35)</span>
                          <span className="font-mono font-medium text-zinc-800">
                            Bs. {formatCurrency(task.result.item35 || task.result.item33 || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Crédito Fiscal (71)</span>
                          <span className="font-mono font-medium text-zinc-800">
                            Bs. {formatCurrency(task.result.item71 || task.result.item34 || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Retenciones (66)</span>
                          <span className="font-mono font-medium text-zinc-800">
                            Bs. {formatCurrency(task.result.item66 || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Total a Pagar (90)</span>
                          <span className="font-mono font-bold text-zinc-900">
                            Bs. {formatCurrency(task.result.item90 || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {successCount > 0 ? (
              <span className="text-emerald-700 font-semibold">
                ✓ {successCount} {successCount === 1 ? 'planilla extraída e insertada en el resumen' : 'planillas extraídas e insertadas en el resumen'}
              </span>
            ) : (
              <span>Selecciona los archivos PDF y presiona procesar para extraer los montos</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={isProcessingAll || tasks.length === 0 || idleCount === 0}
              onClick={handleStartBatchExtraction}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-2 transition-all"
            >
              {isProcessingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extrayendo montos reales...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Extraer Montos {tasks.length > 0 ? `(${idleCount})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
