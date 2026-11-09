import React from 'react';
import { CompanyProfile, IvaQuincenaData, MONTH_NAMES } from '../types';
import {
  calcCuentasPorCobrar,
  calcTotalCompras,
  calcTotalVentas,
  formatCurrency,
  generatePeriodKey,
  auditPeriodHealth,
} from '../utils/taxCalculations';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Receipt,
  PiggyBank,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Edit2,
  ExternalLink,
} from 'lucide-react';

interface TaxAuditInspectorProps {
  company: CompanyProfile;
  onReconcileAll?: () => void;
  onOpenQuincenaModal?: (data: IvaQuincenaData) => void;
}

export const TaxAuditInspector: React.FC<TaxAuditInspectorProps> = ({
  company,
  onReconcileAll,
  onOpenQuincenaModal,
}) => {
  // Compute annual aggregations
  let totalVentasExentas = 0;
  let totalVentasGravadas = 0;
  let totalDebitos = 0;
  let totalCuentasCobrar = 0;
  let totalComprasExentas = 0;
  let totalComprasGravadas = 0;
  let totalCreditosDeducibles = 0;
  let totalRetenciones = 0;
  let totalPagadoSeniat = 0;
  let periodsWithDataCount = 0;

  const health = auditPeriodHealth(company.fiscalYear, company.periodData);

  for (let m = 1; m <= 12; m++) {
    for (let q = 1 as 1 | 2; q <= 2; q++) {
      const pKey = generatePeriodKey(company.fiscalYear, m, q);
      const qData = company.periodData[pKey];

      if (qData) {
        const hasData =
          qData.item40 > 0 ||
          qData.item42 > 0 ||
          qData.item30 > 0 ||
          qData.item33 > 0 ||
          qData.item20 > 0 ||
          Boolean(qData.fileName);

        if (hasData) {
          periodsWithDataCount++;
          totalVentasExentas += qData.item40 || 0;
          totalVentasGravadas += qData.item42 || 0;
          totalDebitos += qData.item47 || 0;
          totalCuentasCobrar += calcCuentasPorCobrar(qData);
          totalComprasExentas += qData.item30 || 0;
          totalComprasGravadas += qData.item33 || 0;
          totalCreditosDeducibles += qData.item71 || (qData.item34 + qData.item343);
          totalRetenciones += qData.item66 || 0;
          totalPagadoSeniat += qData.item90 || 0;
        }
      }
    }
  }

  const totalVentas = totalVentasExentas + totalVentasGravadas;
  const totalCompras = totalComprasExentas + totalComprasGravadas;

  return (
    <div className="space-y-6">
      {/* Annual Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">Total Ventas Anuales</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-900">
            Bs. {formatCurrency(totalVentas)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex justify-between">
            <span>Gravadas: Bs. {formatCurrency(totalVentasGravadas)}</span>
            <span>Exentas: Bs. {formatCurrency(totalVentasExentas)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">Total Débitos Fiscales</span>
            <Receipt className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-xl font-bold font-mono text-pink-900">
            Bs. {formatCurrency(totalDebitos)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Generado en ventas gravadas (16% / 8%)
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase">Total Créditos Deducibles</span>
            <PiggyBank className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-900">
            Bs. {formatCurrency(totalCreditosDeducibles)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Soportado en compras nacionales e importaciones
          </div>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-300 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-bold uppercase">Total Pagado al SENIAT</span>
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-950">
            Bs. {formatCurrency(totalPagadoSeniat)}
          </div>
          <div className="text-[11px] text-emerald-800 mt-1">
            Retenciones deducidas: Bs. {formatCurrency(totalRetenciones)}
          </div>
        </div>
      </div>

      {/* Continuity & SENIAT Audit Verifier */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-zinc-900">
                Auditoría Integral y Continuidad Tributaria SENIAT
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Verificación de arrastre de excedentes de crédito fiscal (Item 20 / Item 60), retenciones acumuladas y consistencia de alícuotas del 16%.
            </p>
          </div>

          {onReconcileAll && (
            <button
              onClick={onReconcileAll}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5 text-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>Auto-Conciliar y Corregir Arrastres</span>
            </button>
          )}
        </div>

        {health.warnings.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-center gap-3 text-xs text-emerald-900">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Estado Óptimo:</span> Todos los saldos de excedente de crédito fiscal, retenciones de IVA no aplicadas y alícuotas del 16% están 100% calibrados matemáticamente sin errores en las 24 quincenas.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Se han detectado {health.warnings.length} discrepancias o discontinuidades de saldo:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {health.warnings.map((alert, idx) => {
                const qData = company.periodData[alert.periodKey];
                return (
                  <div
                    key={idx}
                    className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-bold text-amber-950 flex items-center justify-between">
                        <span>{alert.periodName}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-200/80 rounded">
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">{alert.message}</p>
                    </div>

                    {onOpenQuincenaModal && qData && (
                      <button
                        onClick={() => onOpenQuincenaModal(qData)}
                        className="mt-2 text-indigo-700 hover:text-indigo-900 font-medium text-[11px] flex items-center gap-1 self-end"
                      >
                        <span>Abrir y verificar</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 24-Period Status Matrix */}
        <div className="mt-4 pt-4 border-t border-zinc-200">
          <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-2">
            Matriz de Estado por Quincena ({company.fiscalYear})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 text-[11px]">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) =>
              [1, 2].map((q) => {
                const pKey = generatePeriodKey(company.fiscalYear, m, q as 1 | 2);
                const qData = company.periodData[pKey];
                const hasData = Boolean(
                  qData && (qData.item40 > 0 || qData.item42 > 0 || qData.item30 > 0 || qData.item33 > 0 || qData.item20 > 0 || qData.fileName)
                );
                const hasWarning = health.warnings.some((w) => w.periodKey === pKey);

                return (
                  <button
                    key={`${m}-${q}`}
                    onClick={() => qData && onOpenQuincenaModal && onOpenQuincenaModal(qData)}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      hasWarning
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold hover:bg-amber-100'
                        : hasData
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:bg-zinc-100'
                    }`}
                    title={`${MONTH_NAMES[m - 1]} ${q === 1 ? '1ª Q' : '2ª Q'}: ${hasWarning ? 'Discrepancia detectada' : hasData ? 'Cargada' : 'Sin datos'}`}
                  >
                    <div className="font-bold text-[10px] text-zinc-700">{MONTH_NAMES[m - 1].slice(0, 3)}</div>
                    <div className="text-[10px]">{q === 1 ? '1Q' : '2Q'}</div>
                    <div className="mt-1">
                      {hasWarning ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                      ) : hasData ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-300" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

