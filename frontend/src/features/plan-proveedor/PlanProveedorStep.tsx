import { useEffect, useState } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { PLAN_CATALOG, CATEGORY_LABELS } from '../../lib/planCatalog';
import {
  Check, Star, Briefcase, Truck, User as UserIcon, Crown,
  Shield, ChevronDown, ShieldCheck,
  Loader2, AlertTriangle, BadgeCheck,
  Building2, Stethoscope, RefreshCw, Sparkles, CheckCircle2,
} from 'lucide-react';
import type { Plan, ProveedorItem } from '../../types';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';
import { getProveedores, quotePolicy } from '../../lib/api';
import { vehicleSignature, vesMonthly, vesAnnual } from '../../lib/money';
import { toast } from '../../store/toastStore';
import { getProductConfig } from '../../lib/product';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  personal: UserIcon,
  premium: Crown,
  comercial: Briefcase,
  flota: Truck,
};

function defaultCategoryFromUso(uso?: string): string {
  const u = (uso || '').toLowerCase();
  if (u.includes('comercial') || u.includes('carga') || u.includes('transporte')) {
    return 'comercial';
  }
  return 'personal';
}

export interface PlanProveedorStepProps {
  onPlanSelect?: (plan: Plan) => void;
  onProveedorSelect?: (proveedor: ProveedorItem) => void;
  title?: string;
  subtitle?: string;
  cramo?: number;
  centidad?: number;
  citem?: number;
}

export function PlanProveedorStep({
  onPlanSelect,
  onProveedorSelect,
  title,
  subtitle,
  cramo: customCramo,
  centidad: customCentidad,
  citem: customCitem,
}: PlanProveedorStepProps) {
  const {
    category, setCategory, selectedPlan, setSelectedPlan,
    selectedProveedor, setProveedor,
    vehicle, quote, quoteState,
  } = useWizardStore();

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [proveedores, setProveedores] = useState<ProveedorItem[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState<boolean>(false);
  const [proveedoresError, setProveedoresError] = useState<string | null>(null);

  const productConfig = getProductConfig();
  const effectiveCramo = customCramo ?? productConfig.cramo ?? 18;
  const effectiveCentidad = customCentidad ?? 1;
  const effectiveCitem = customCitem ?? 1;

  const plans = category ? PLAN_CATALOG[category] ?? [] : [];

  // Auto-preselección al entrar
  useEffect(() => {
    if (category && selectedPlan) return;
    const hasVehicleData =
      Boolean(vehicle.marca?.trim()) && Boolean(vehicle.modelo?.trim());
    if (!hasVehicleData) return;

    const cat = category || defaultCategoryFromUso(vehicle.uso);
    const defaultPlan = PLAN_CATALOG[cat]?.[0] ?? null;

    if (!category) setCategory(cat);
    if (!selectedPlan && defaultPlan) {
      setSelectedPlan(defaultPlan);
      onPlanSelect?.(defaultPlan);
    }
  }, [vehicle.marca, vehicle.modelo, vehicle.uso, category, selectedPlan, setCategory, setSelectedPlan, onPlanSelect]);

  // Cotización automática contra La Mundial (si aplica a vehículo)
  const hasVehicleData =
    Boolean(vehicle.marca?.trim()) &&
    Boolean(vehicle.modelo?.trim()) &&
    Boolean(vehicle.año?.trim());
  const sig = hasVehicleData ? vehicleSignature(vehicle) : '';

  useEffect(() => {
    if (!sig) return;

    const snap = useWizardStore.getState();
    if (snap.quote && snap.quoteVehicleSignature === sig) return;
    if (snap.quoteState === 'loading') return;

    snap.setQuoteState('loading');

    quotePolicy({
      state: { vehicle },
      plan: 'RCVBAS',
    })
      .then((r) => {
        const cur = useWizardStore.getState();
        if (cur.quote && cur.quoteVehicleSignature && cur.quoteVehicleSignature !== sig) return;

        const meta = r.metadata as
          | { vehicleLabel?: string; vehicleFallback?: boolean }
          | undefined;
        useWizardStore.getState().setQuote(
          {
            mprima: r.mprima,
            mprimaext: r.mprimaext,
            ptasa: r.ptasa,
            vehicleLabel: meta?.vehicleLabel,
            vehicleFallback: meta?.vehicleFallback,
          },
          sig
        );
      })
      .catch((err) => {
        const cur = useWizardStore.getState();
        if (cur.quote && cur.quoteVehicleSignature && cur.quoteVehicleSignature !== sig) return;

        const message =
          (err as { message?: string })?.message ?? 'No pudimos obtener la tarifa.';
        useWizardStore.getState().setQuoteState('error', message);
      });
  }, [sig, vehicle]);

  // Carga de Proveedores al seleccionar el Plan
  const fetchProveedores = async () => {
    if (!selectedPlan) return;
    setLoadingProveedores(true);
    setProveedoresError(null);
    try {
      const items = await getProveedores({
        cplan: selectedPlan.cplan || selectedPlan.name,
        cramo: selectedPlan.cramo ?? effectiveCramo,
        centidad: selectedPlan.centidad ?? effectiveCentidad,
        citem: selectedPlan.citem ?? effectiveCitem,
      });
      setProveedores(items);

      // Si no hay proveedor seleccionado o el que estaba no existe en la lista, auto-seleccionar el primero
      if (items.length > 0) {
        const exists = selectedProveedor && items.some((p) => String(p.cci_rif) === String(selectedProveedor.cci_rif));
        if (!exists) {
          setProveedor(items[0]);
          onProveedorSelect?.(items[0]);
        }
      }
    } catch (e) {
      const msg = (e as Error).message || 'Error al consultar proveedores de servicio.';
      setProveedoresError(msg);
    } finally {
      setLoadingProveedores(false);
    }
  };

  useEffect(() => {
    if (selectedPlan) {
      void fetchProveedores();
    } else {
      setProveedores([]);
      setProveedor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.name, selectedPlan?.cplan, effectiveCramo, effectiveCentidad, effectiveCitem]);

  const isLoadingQuote = quoteState === 'loading';
  const hasRealQuote = quoteState === 'ready' && Boolean(quote);

  const annualUsd = hasRealQuote ? quote!.mprimaext : (selectedPlan?.priceNum ?? 0) * 12;
  const monthlyUsd = hasRealQuote ? quote!.mprimaext / 12 : selectedPlan?.priceNum ?? 0;
  const displayPrice = billing === 'annual' ? annualUsd : monthlyUsd;

  const CategoryIcon = category ? (CATEGORY_ICONS[category] ?? UserIcon) : Shield;

  const handleSelectPlan = (planName: string) => {
    const p = plans.find((item) => item.name === planName);
    setSelectedPlan(p ?? null);
    if (p) onPlanSelect?.(p);
  };

  const handleSelectProveedor = (item: ProveedorItem) => {
    setProveedor(item);
    onProveedorSelect?.(item);
    toast.success('Proveedor de servicio seleccionado', `${item.xproveedor} (RIF: ${item.cci_rif})`);
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header & Controls */}
      <div className="flex items-start justify-between gap-4 flex-wrap -mt-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            {title || 'Planes y Proveedores de Servicio'}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed max-w-md">
            {subtitle || 'Selecciona el plan de cobertura y el proveedor de servicio asignado.'}
          </p>
        </div>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
          {(['monthly', 'annual'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              className={`
                relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                ${billing === b
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }
              `}
            >
              {b === 'monthly' ? 'Mensual' : 'Anual'}
            </button>
          ))}
        </div>
      </div>

      {/* Combo selectors row: Categoria & Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category select */}
        <div>
          <label className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <Shield size={11} className="text-indigo-500" />
            Categoría de uso
          </label>
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white shadow-[0_4px_14px_rgba(15,26,90,0.3)] pointer-events-none">
              <CategoryIcon size={15} strokeWidth={2.2} />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full pl-14 pr-10 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-900 appearance-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              <option value="">Selecciona categoría...</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Plan select */}
        <div>
          <label className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <Star size={11} className="text-violet-500" />
            Plan de cobertura
          </label>
          <div className="relative group">
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg grid place-items-center pointer-events-none transition-all ${
              selectedPlan
                ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_4px_14px_rgba(46,109,191,0.3)]'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <Check size={15} strokeWidth={2.5} />
            </div>
            <select
              value={selectedPlan?.name ?? ''}
              onChange={(e) => handleSelectPlan(e.target.value)}
              disabled={!category || plans.length === 0}
              className="w-full pl-14 pr-10 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-900 appearance-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {category ? 'Selecciona un plan...' : 'Primero elige categoría'}
              </option>
              {plans.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Proveedor de Servicio - Se despliega al seleccionar el Plan */}
      {selectedPlan && (
        <div className="animate-spring-in rounded-2xl border-2 border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 via-white to-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 grid place-items-center text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]">
                <Building2 size={18} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-black text-slate-900 text-base">
                    Proveedor de Servicio
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <Sparkles size={10} />
                    valrep/proveedores
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecciona la entidad proveedora de asistencia para este plan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void fetchProveedores()}
              disabled={loadingProveedores}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/50 transition-colors disabled:opacity-50"
              title="Recargar proveedores"
            >
              <RefreshCw size={13} className={loadingProveedores ? 'animate-spin' : ''} />
              <span>{loadingProveedores ? 'Consultando…' : 'Actualizar'}</span>
            </button>
          </div>

          {/* Estado de carga */}
          {loadingProveedores && (
            <div className="flex items-center justify-center py-6 px-4 rounded-xl border border-indigo-100 bg-indigo-50/40 gap-3 text-indigo-700 text-sm font-medium">
              <Loader2 size={18} className="animate-spin text-indigo-600" />
              <span>Consultando proveedores para {selectedPlan.name}…</span>
            </div>
          )}

          {/* Error */}
          {proveedoresError && !loadingProveedores && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium mb-3">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{proveedoresError}</span>
            </div>
          )}

          {/* Selector de proveedores interactivo */}
          {!loadingProveedores && proveedores.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proveedores.map((item) => {
                  const isSelected = selectedProveedor && String(selectedProveedor.cci_rif) === String(item.cci_rif);
                  return (
                    <div
                      key={String(item.cci_rif)}
                      onClick={() => handleSelectProveedor(item)}
                      role="button"
                      tabIndex={0}
                      className={`
                        relative flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer select-none
                        ${isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/80'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Stethoscope size={16} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                            {item.xproveedor}
                          </p>
                          <p className="text-[0.7rem] text-slate-500 font-mono font-medium">
                            RIF / ID: <span className="font-bold">{item.cci_rif}</span>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white grid place-items-center shadow-sm">
                            <Check size={13} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payload indicator badge */}
              {selectedProveedor && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-100 text-[0.72rem] text-indigo-900 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={14} className="text-indigo-600" />
                    Proveedor seleccionado: <strong>{selectedProveedor.xproveedor}</strong>
                  </span>
                  <span className="font-mono text-[0.68rem] bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-semibold">
                    &#123; cproveedor: {selectedProveedor.cci_rif} &#125;
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sin proveedores disponibles */}
          {!loadingProveedores && proveedores.length === 0 && !proveedoresError && (
            <p className="text-xs text-slate-500 text-center py-4 font-medium">
              No se encontraron proveedores de servicio para este plan.
            </p>
          )}
        </div>
      )}

      {/* Plan detail card */}
      {selectedPlan ? (
        <PlanDetailCard
          plan={selectedPlan}
          billing={billing}
          displayPrice={displayPrice}
          isLoadingQuote={isLoadingQuote}
          hasRealQuote={hasRealQuote}
          quoteVes={billing === 'monthly' ? vesMonthly(quote) : vesAnnual(quote)}
          ptasa={quote?.ptasa}
          vehicleLabel={quote?.vehicleLabel}
          vehicleFallback={quote?.vehicleFallback}
          quoteError={quoteState === 'error'}
          quote={quote}
          selectedProveedor={selectedProveedor}
        />
      ) : (
        <div className="text-center py-14 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50/70 to-white">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 grid place-items-center mx-auto mb-3 shadow-sm">
            <Shield size={22} className="text-slate-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium">
            {category
              ? 'Elige un plan en el combo para ver los detalles de cobertura y seleccionar el proveedor.'
              : 'Selecciona una categoría y luego un plan para desplegar el selector de proveedor.'}
          </p>
        </div>
      )}
    </div>
  );
}

function PlanDetailCard({
  plan, billing, displayPrice,
  isLoadingQuote, hasRealQuote, quoteVes, ptasa,
  vehicleLabel, vehicleFallback, quoteError,
  quote,
  selectedProveedor,
}: {
  plan: Plan;
  billing: 'monthly' | 'annual';
  displayPrice: number;
  isLoadingQuote: boolean;
  hasRealQuote: boolean;
  quoteVes: number;
  ptasa?: number;
  vehicleLabel?: string;
  vehicleFallback?: boolean;
  quoteError: boolean;
  quote: import('../../types').PolicyQuote | null;
  selectedProveedor?: ProveedorItem | null;
}) {
  return (
    <article className="relative rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-50/90 via-violet-50/40 to-white p-4 sm:p-6 shadow-[0_24px_48px_-12px_rgba(15,26,90,0.22)] animate-spring-in overflow-hidden">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-fuchsia-500/12 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-indigo-500/12 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 rounded-2xl gradient-border pointer-events-none" />

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-5 mb-5">
          <div className="min-w-0 flex-1">
            <span className="inline-block px-2 py-0.5 rounded-md bg-white text-slate-500 text-[0.62rem] font-bold mb-2 uppercase tracking-wider border border-slate-200">
              {plan.tag}
            </span>
            <h3 className="font-display font-black text-slate-900 text-xl sm:text-2xl leading-tight break-words">{plan.name}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md">{plan.desc}</p>

            {/* Badges de estado de cotizacion */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hasRealQuote && !vehicleFallback && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 uppercase tracking-wider">
                  <BadgeCheck size={11} strokeWidth={2.4} />
                  Tarifa La Mundial
                </span>
              )}
              {hasRealQuote && vehicleFallback && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 uppercase tracking-wider">
                  <AlertTriangle size={11} strokeWidth={2.4} />
                  Tarifa estimada
                </span>
              )}
              {hasRealQuote && vehicleLabel && (
                <span className="inline-flex items-center text-[0.6rem] font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 uppercase tracking-wider">
                  {vehicleLabel}
                </span>
              )}
              {selectedProveedor && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 uppercase tracking-wider">
                  <Building2 size={11} />
                  {selectedProveedor.xproveedor}
                </span>
              )}
              {quoteError && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-200 uppercase tracking-wider">
                  <AlertTriangle size={11} strokeWidth={2.4} />
                  Cotización pendiente
                </span>
              )}
            </div>
          </div>

          {/* Right column: price */}
          <div className="w-full sm:w-auto sm:shrink-0 sm:max-w-[260px] flex flex-col items-stretch sm:items-end gap-3">
            <div className="text-left sm:text-right">
              <div className="flex items-end gap-1 sm:justify-end">
                <span className="text-base sm:text-[1.2rem] font-display font-black text-slate-500 leading-none pb-1 sm:pb-2">$</span>
                {isLoadingQuote && !hasRealQuote ? (
                  <span className="text-4xl sm:text-5xl font-display font-black gradient-text-indigo leading-none tabular-nums inline-flex items-center gap-2">
                    <Loader2 size={28} className="animate-spin opacity-70" />
                    <span className="opacity-50">---</span>
                  </span>
                ) : (
                  <span className="text-4xl sm:text-5xl font-display font-black gradient-text-indigo leading-none tabular-nums">
                    <AnimatedCounter
                      value={displayPrice}
                      duration={500}
                      decimals={hasRealQuote ? 2 : 0}
                    />
                  </span>
                )}
                <span className="text-[0.7rem] text-slate-500 font-semibold pb-1.5 sm:hidden">
                  / {billing === 'monthly' ? 'mes' : 'año'}
                </span>
              </div>
              <p className="hidden sm:block text-[0.7rem] text-slate-500 font-semibold mt-1">
                / {billing === 'monthly' ? 'mes' : 'año'}
              </p>

              {hasRealQuote && quoteVes > 0 && (
                <p className="text-[0.65rem] font-bold text-indigo-700/80 mt-1.5 tabular-nums">
                  ≈ Bs{' '}
                  {quoteVes.toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
              {hasRealQuote && ptasa && ptasa > 0 && (
                <p className="text-[0.6rem] text-slate-500 mt-0.5 tabular-nums">
                  Tasa de cambio: {ptasa.toFixed(2)} Bs/$
                </p>
              )}
            </div>

            <PrimaCard
              quote={quote}
              isLoading={isLoadingQuote && !hasRealQuote}
              hasReal={hasRealQuote}
              billing={billing}
            />
          </div>
        </div>

        <div className="divider-soft mb-5" />

        {/* Coverage / benefits */}
        <p className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
          <Shield size={11} className="text-indigo-500" />
          Cobertura incluida
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {plan.benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-xs text-slate-700">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white grid place-items-center flex-shrink-0 mt-0.5 shadow-[0_2px_8px_rgba(16,185,129,0.3)]">
                <Check size={9} strokeWidth={3.5} />
              </span>
              <span className="leading-relaxed font-medium">{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 pt-4 border-t border-indigo-100/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold text-indigo-600">
            <Shield size={11} />
            Plan seleccionado
          </div>
          <div className="text-[0.62rem] text-slate-500 font-medium">
            Pagas {billing === 'monthly' ? 'mensualmente' : 'anualmente'}
          </div>
        </div>
      </div>
    </article>
  );
}

function PrimaCard({
  quote,
  isLoading,
  hasReal,
  billing,
}: {
  quote: import('../../types').PolicyQuote | null;
  isLoading: boolean;
  hasReal: boolean;
  billing: 'monthly' | 'annual';
}) {
  const isMonthly = billing === 'monthly';

  if (isLoading) {
    return (
      <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800 via-indigo-700 to-violet-700 p-4 sm:p-5 shadow-[0_22px_42px_-14px_rgba(9,17,51,0.6)] ring-1 ring-white/10 flex flex-col gap-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/20" />
          <div className="h-3 w-28 bg-white/20 rounded-full" />
        </div>
        <div className="h-8 w-24 bg-white/20 rounded-lg" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-white/10 rounded-full" />
          <div className="h-3 w-3/4 bg-white/10 rounded-full" />
          <div className="h-3 w-1/2 bg-white/10 rounded-full" />
        </div>
      </div>
    );
  }

  if (!hasReal || !quote) {
    return (
      <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 p-4 sm:p-5 ring-1 ring-white/10 flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-lg bg-white/10 grid place-items-center ring-1 ring-white/15">
            <Loader2 size={12} className="text-white/60 animate-spin" />
          </span>
          <span className="text-[0.62rem] font-black text-white/70 uppercase tracking-widest">Prima oficial</span>
        </div>
        <p className="text-white/50 text-xs leading-relaxed">
          Completa los datos del vehículo para obtener la tarifa real de La Mundial.
        </p>
      </div>
    );
  }

  const usdMain  = isMonthly ? quote.mprimaext / 12 : quote.mprimaext;
  const vesMain  = isMonthly ? quote.mprima / 12    : quote.mprima;
  const usdOther = isMonthly ? quote.mprimaext      : quote.mprimaext / 12;
  const vesOther = isMonthly ? quote.mprima         : quote.mprima / 12;

  const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800 via-indigo-700 to-violet-700 p-4 sm:p-5 shadow-[0_22px_42px_-14px_rgba(9,17,51,0.6)] ring-1 ring-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_55%)] pointer-events-none" />
      <div className="absolute -bottom-20 -right-12 w-44 h-44 rounded-full bg-fuchsia-500/18 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-2 text-[0.62rem] font-black text-white uppercase tracking-widest">
            <span className="w-6 h-6 rounded-lg bg-white/15 grid place-items-center ring-1 ring-white/20">
              <ShieldCheck size={12} className="text-white" strokeWidth={2.5} />
            </span>
            Prima La Mundial
          </span>
          <span className="text-[0.55rem] font-black text-emerald-200 bg-emerald-500/20 px-2 py-0.5 rounded-md ring-1 ring-emerald-300/30 tracking-wider">
            OFICIAL
          </span>
        </div>

        <div className="flex items-baseline gap-1 mb-0.5">
          <span className="text-base font-display font-black text-white/50 leading-none pb-1">$</span>
          <span className="font-display font-black text-white text-[2.1rem] leading-none tabular-nums tracking-tight">
            {usdMain.toFixed(2)}
          </span>
          <span className="text-[0.7rem] text-white/50 font-semibold pb-1 ml-1">
            USD / {isMonthly ? 'mes' : 'año'}
          </span>
        </div>

        <p className="text-[0.72rem] font-bold text-indigo-300 tabular-nums mb-3">
          ≈ Bs {fmt(vesMain)} / {isMonthly ? 'mes' : 'año'}
        </p>

        <div className="h-px bg-white/10 mb-3" />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[0.67rem]">
            <span className="text-white/55">{isMonthly ? 'Total anual USD' : 'Mensual USD'}</span>
            <span className="font-bold text-white/80 tabular-nums">${usdOther.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-[0.67rem]">
            <span className="text-white/55">{isMonthly ? 'Total anual Bs' : 'Mensual Bs'}</span>
            <span className="font-bold text-white/80 tabular-nums">Bs {fmt(vesOther)}</span>
          </div>
          {quote.ptasa && quote.ptasa > 0 && (
            <div className="flex items-center justify-between text-[0.67rem] pt-1 border-t border-white/10">
              <span className="text-white/40">Tasa de cambio</span>
              <span className="text-white/50 tabular-nums">{quote.ptasa.toFixed(2)} Bs/$</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
