import React, { useState, useEffect } from 'react';
import { IvaQuincenaData, MONTH_NAMES } from '../types';
import {
  calcCuentasPorCobrar,
  calcTotalCompras,
  calcTotalVentas,
  formatCurrency,
  parseCurrencyInput,
  recalculateSingleQuincena,
} from '../utils/taxCalculations';
import {
  X,
  Check,
  FileText,
  Calendar,
  Building2,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface QuincenaDetailModalProps {
  quincenaData: IvaQuincenaData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: IvaQuincenaData) => void;
  companyName: string;
  rif: string;
}

export const QuincenaDetailModal: React.FC<QuincenaDetailModalProps> = ({
  quincenaData,
  isOpen,
  onClose,
  onSave,
  companyName,
  rif,
}) => {
  const [formData, setFormData] = useState<IvaQuincenaData | null>(null);

  useEffect(() => {
    if (quincenaData) {
      setFormData({ ...quincenaData });
    }
  }, [quincenaData]);

  if (!isOpen || !formData) return null;

  const handleInputChange = (field: keyof IvaQuincenaData, valueStr: string) => {
    const num = parseCurrencyInput(valueStr);
    setFormData((prev) => (prev ? { ...prev, [field]: num } : null));
  };

  const handleAutoCalculate = () => {
    if (formData) {
      const recalculated = recalculateSingleQuincena(formData);
      setFormData(recalculated);
    }
  };

  const handleSave = () => {
    if (formData) {
      const calibrated = recalculateSingleQuincena(formData);
      onSave(calibrated);
      onClose();
    }
  };

  // Recalculated values
  const totalVentas = calcTotalVentas(formData);
  const cuentasPorCobrar = calcCuentasPorCobrar(formData);
  const totalCompras = calcTotalCompras(formData);
  const totalCreditosDeducibles = (formData.item70 || (formData.item34 + formData.item343)) + (formData.item37 || 0);
  const totalCreditosDelMes = totalCreditosDeducibles + (formData.item20 || 0) + (formData.item38 || 0);
  const cuotaTributaria = Math.max(0, formData.item47 - totalCreditosDelMes);

  // Consistency audit
  const debitoCalculado = formData.item42 * 0.16;
  const debitoDiff = Math.abs(debitoCalculado - formData.item47);
  const isDebitoAccurate = debitoDiff < 1.0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 text-pink-300 rounded-lg border border-pink-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-pink-300 font-bold uppercase tracking-wider">
                {formData.year} {MONTH_NAMES[formData.month - 1]} — {formData.quincena === 1 ? '1RA QUINCENA (1-15)' : '2DA QUINCENA (16-FIN)'}
              </div>
              <h3 className="font-bold text-base text-white">
                Detalle de Declaración de IVA (Forma 30 SENIAT)
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoCalculate}
              type="button"
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-emerald-300 rounded-lg border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
              title="Recalcular automáticamente débitos, créditos y totales conforme a las fórmulas del SENIAT"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-Calcular Fórmulas</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Metadata Bar */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Empresa / RIF</div>
              <div className="font-bold text-zinc-800 truncate">{companyName}</div>
              <div className="font-mono text-zinc-600">{rif}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">No. Declaración / Certificado</div>
              <div className="font-mono font-medium text-zinc-800">{formData.numeroDeclaracion || 'N/A'}</div>
              <div className="text-[11px] text-zinc-500">{formData.numeroCertificado || ''}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Período de Imposición</div>
              <div className="font-medium text-zinc-800">
                {formData.fechaDesde || 'Inicio'} al {formData.fechaHasta || 'Cierre'}
              </div>
              <div className="text-[11px] text-zinc-500">Pres: {formData.fechaDeclaracion || 'No registrada'}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Archivo Origen</div>
              <div className="flex items-center gap-1.5 font-medium text-zinc-800 truncate" title={formData.fileName}>
                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{formData.fileName || 'Carga manual'}</span>
              </div>
            </div>
          </div>

          {/* Audit alert if any */}
          {!isDebitoAccurate && formData.item42 > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Observación Técnica:</span> El Débito Fiscal declarado (Bs. {formatCurrency(formData.item47)}) difiere del 16% teórico de las ventas gravadas (Bs. {formatCurrency(debitoCalculado)}). Puedes usar el botón "Auto-Calcular Fórmulas" para ajustarlo.
              </div>
            </div>
          )}

          {/* SECTION 1: DÉBITOS FISCALES / VENTAS */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-900 text-sm border-b border-zinc-200 pb-1.5 flex items-center justify-between">
              <span>1. Ventas y Débitos Fiscales</span>
              <span className="text-xs text-zinc-500 font-normal">Base Imponible y Cuotas</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Ventas No Gravadas / Exentas (Item 40)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right focus:ring-1 focus:ring-emerald-500"
                  value={formData.item40 || ''}
                  onChange={(e) => handleInputChange('item40', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Ventas Gravadas 16% (Item 42)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right focus:ring-1 focus:ring-emerald-500"
                  value={formData.item42 || ''}
                  onChange={(e) => handleInputChange('item42', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Total Débito Fiscal (Item 47)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono font-bold text-zinc-900 text-right focus:ring-1 focus:ring-emerald-500"
                  value={formData.item47 || ''}
                  onChange={(e) => handleInputChange('item47', e.target.value)}
                />
              </div>
            </div>

            {/* Cuentas Por Cobrar Highlight Bar */}
            <div className="bg-[#FEF08A] border border-yellow-400 p-3 rounded-xl flex items-center justify-between font-bold text-zinc-950">
              <span>CUENTAS POR COBRAR (TOTAL VENTAS + DÉBITO FISCAL):</span>
              <span className="font-mono text-sm">Bs. {formatCurrency(cuentasPorCobrar)}</span>
            </div>
          </div>

          {/* SECTION 2: COMPRAS Y CRÉDITOS FISCALES */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-900 text-sm border-b border-zinc-200 pb-1.5 flex items-center justify-between">
              <span>2. Compras y Créditos Fiscales</span>
              <span className="text-xs text-zinc-500 font-normal">Bases y Créditos Deducibles</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Compras Exentas (Item 30)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item30 || ''}
                  onChange={(e) => handleInputChange('item30', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Compras Gravadas 16% (Item 33)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item33 || ''}
                  onChange={(e) => handleInputChange('item33', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Crédito Fiscal 16% (Item 34)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item34 || ''}
                  onChange={(e) => handleInputChange('item34', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Total Compras (Item 35)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono font-bold text-zinc-900 text-right"
                  value={formData.item35 || ''}
                  onChange={(e) => handleInputChange('item35', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Alícuota Reducida Crédito (Item 343)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item343 || ''}
                  onChange={(e) => handleInputChange('item343', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Créditos Totalmente Deducibles (Item 70)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item70 || ''}
                  onChange={(e) => handleInputChange('item70', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Total Créditos Deducibles (Item 71)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono font-bold text-zinc-900 text-right"
                  value={formData.item71 || ''}
                  onChange={(e) => handleInputChange('item71', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: DETERMINACIÓN, RETENCIONES Y TOTAL A PAGAR */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-900 text-sm border-b border-zinc-200 pb-1.5 flex items-center justify-between">
              <span>3. Liquidación, Excedentes, Retenciones y Total a Pagar</span>
              <span className="text-xs text-zinc-500 font-normal">Autoliquidación y Arrastre</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Excedente Mes Anterior (Item 20)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item20 || ''}
                  onChange={(e) => handleInputChange('item20', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Total Cuota Tributaria (Item 53)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono font-bold text-zinc-900 text-right"
                  value={formData.item53 || ''}
                  onChange={(e) => handleInputChange('item53', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Retenciones Acumuladas (Item 54)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item54 || ''}
                  onChange={(e) => handleInputChange('item54', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Retenciones del Período (Item 66)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item66 || ''}
                  onChange={(e) => handleInputChange('item66', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Excedente Crédito Mes Siguiente (Item 60)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item60 || ''}
                  onChange={(e) => handleInputChange('item60', e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Saldo Retenciones No Aplicadas (Item 67)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 font-mono text-zinc-900 text-right"
                  value={formData.item67 || ''}
                  onChange={(e) => handleInputChange('item67', e.target.value)}
                />
              </div>

              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-300">
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  TOTAL A PAGAR (Item 90)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-white border border-emerald-400 rounded px-2.5 py-1.5 font-mono font-bold text-emerald-950 text-right text-sm"
                  value={formData.item90 || ''}
                  onChange={(e) => handleInputChange('item90', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoCalculate}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 rounded-lg border border-zinc-300 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
              <span>Recalcular Fórmulas</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Guardar y Calibrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

