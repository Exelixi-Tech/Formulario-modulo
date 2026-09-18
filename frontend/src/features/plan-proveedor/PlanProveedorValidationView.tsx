import { useState, useEffect } from 'react';
import { PlanProveedorStep } from './PlanProveedorStep';
import { useWizardStore } from '../../store/wizardStore';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Toaster } from '../../components/Toaster';
import { toast } from '../../store/toastStore';
import { TokenManagerModal } from '../../components/TokenManagerModal';
import { isTokenAuthEnabled } from '../../lib/token-manager';
import {
  ShieldCheck,
  Sparkles,
  Car,
  Layers,
  Code2,
  CheckCircle2,
  AlertCircle,
  Copy,
  RotateCcw,
  Sliders,
  Building2,
  Check,
  Flame,
  ArrowRight,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import type { Plan, ProveedorItem } from '../../types';

interface VehiclePreset {
  label: string;
  desc: string;
  marca: string;
  modelo: string;
  año: string;
  uso: string;
  placa: string;
  serial: string;
}

const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    label: 'Particular (Toyota Corolla)',
    desc: 'Sedán de uso personal / particular',
    marca: 'TOYOTA',
    modelo: 'COROLLA',
    año: '2020',
    uso: 'Particular',
    placa: 'AB123CD',
    serial: '8X123456789012345',
  },
  {
    label: 'Comercial (Ford F-350)',
    desc: 'Carga / transporte comercial',
    marca: 'FORD',
    modelo: 'F-350',
    año: '2018',
    uso: 'Comercial',
    placa: 'AC987EF',
    serial: '3F123456789012345',
  },
  {
    label: 'Moto / Flota (Yamaha)',
    desc: 'Vehículo de flota corporativa',
    marca: 'YAMAHA',
    modelo: 'XTZ 250',
    año: '2022',
    uso: 'Flota',
    placa: 'MOTO01',
    serial: '9Y123456789012345',
  },
];

export function PlanProveedorValidationView() {
  const {
    category,
    selectedPlan,
    selectedProveedor,
    cproveedor,
    vehicle,
    quote,
    quoteState,
    setVehicle,
    reset,
  } = useWizardStore();

  // Props personalizables para el componente PlanProveedorStep
  const [customTitle, setCustomTitle] = useState('Planes y Proveedores de Servicio');
  const [customSubtitle, setCustomSubtitle] = useState(
    'Selecciona el plan de cobertura y el proveedor de asistencia asignado.'
  );
  const [cramo, setCramo] = useState<number>(18);
  const [centidad, setCentidad] = useState<number>(1);
  const [citem, setCitem] = useState<number>(1);

  // Registro de eventos para inspección
  const [lastPlanEvent, setLastPlanEvent] = useState<Plan | null>(null);
  const [lastProveedorEvent, setLastProveedorEvent] = useState<ProveedorItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'payload' | 'settings'>('preview');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokensEnabled, setTokensEnabled] = useState(isTokenAuthEnabled());

  useEffect(() => {
    const handleSyncTokens = () => {
      setTokensEnabled(isTokenAuthEnabled());
    };
    window.addEventListener('nexus_token_state_changed', handleSyncTokens);
    return () => window.removeEventListener('nexus_token_state_changed', handleSyncTokens);
  }, []);

  // Estado de validación
  const hasPlan = Boolean(selectedPlan);
  const hasProveedor = Boolean(selectedProveedor || cproveedor);
  const isComplete = hasPlan && hasProveedor;

  const handleApplyPreset = (preset: VehiclePreset) => {
    setVehicle({
      marca: preset.marca,
      modelo: preset.modelo,
      año: preset.año,
      uso: preset.uso,
      placa: preset.placa,
      serial: preset.serial,
    });
    toast.success('Vehículo simulado cargado', `${preset.marca} ${preset.modelo} (${preset.uso})`);
  };

  const handleClearVehicle = () => {
    setVehicle({
      marca: '',
      modelo: '',
      año: '',
      uso: 'Particular',
      placa: '',
      serial: '',
    });
    toast.info('Datos de vehículo limpiados');
  };

  const handleValidateForm = () => {
    if (!selectedPlan) {
      toast.error('Validación fallida', 'Debe seleccionar un plan de cobertura.');
      return;
    }
    if (!selectedProveedor && !cproveedor) {
      toast.error('Validación fallida', 'Debe seleccionar un proveedor de servicio asignado.');
      return;
    }
    toast.success(
      '¡Formulario validado con éxito!',
      `Plan: ${selectedPlan.name} · Proveedor: ${selectedProveedor?.xproveedor ?? cproveedor}`
    );
  };

  const getHandoffSnapshot = () => {
    return {
      validationMode: tokensEnabled ? 'nexus_authenticated' : 'unauthenticated_test_harness',
      tokensActive: tokensEnabled,
      timestamp: new Date().toISOString(),
      category,
      selectedPlan: selectedPlan
        ? {
            name: selectedPlan.name,
            cplan: selectedPlan.cplan,
            tag: selectedPlan.tag,
            priceNum: selectedPlan.priceNum,
            cramo: selectedPlan.cramo ?? cramo,
            centidad: selectedPlan.centidad ?? centidad,
            citem: selectedPlan.citem ?? citem,
          }
        : null,
      selectedProveedor,
      cproveedor: cproveedor ?? (selectedProveedor ? selectedProveedor.cci_rif : null),
      quoteState,
      quote: quote
        ? {
            mprima: quote.mprima,
            mprimaext: quote.mprimaext,
            ptasa: quote.ptasa,
          }
        : null,
      vehicle: {
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        año: vehicle.año,
        uso: vehicle.uso,
        placa: vehicle.placa,
      },
    };
  };

  const handleCopyPayload = () => {
    const payloadStr = JSON.stringify(getHandoffSnapshot(), null, 2);
    navigator.clipboard.writeText(payloadStr);
    setCopied(true);
    toast.success('Copiado al portapapeles', 'Payload de selección y estado copiado en formato JSON.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen relative bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white pb-20">
      <Toaster />
      <AuroraBackground />

      {/* Header Banner con Control de Tokens */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 grid place-items-center text-white shadow-lg shadow-indigo-500/25">
            <Flame size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-tight">
                Validador Plan-Proveedor
              </h1>
              <button
                type="button"
                onClick={() => setShowTokenModal(true)}
                className={`text-[0.62rem] font-black uppercase px-2.5 py-0.5 rounded-full border tracking-wider transition-all hover:scale-105 cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  tokensEnabled
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                }`}
                title="Abrir Formulario y Gestor de Tokens"
              >
                <KeyRound size={11} />
                <span>{tokensEnabled ? 'Con Tokens · Nexus SSO' : 'Sin Tokens · Acceso Directo'}</span>
              </button>
            </div>
            <p className="text-[0.7rem] text-slate-400">
              Formulario de pruebas y validación reactiva para el componente PlanProveedor
            </p>
          </div>
        </div>

        {/* Status badges & Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowTokenModal(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm"
          >
            <KeyRound size={14} className="text-indigo-400" />
            <span>Gestionar Tokens</span>
          </button>

          <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
            isComplete
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
          }`}>
            {isComplete ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{isComplete ? 'Formulario Válido' : 'Selección Incompleta'}</span>
          </div>

          <button
            type="button"
            onClick={handleValidateForm}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 inline-flex items-center gap-1.5"
          >
            <ShieldCheck size={14} />
            <span>Validar Formulario</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPayload}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all inline-flex items-center gap-1.5"
            title="Copiar JSON del Estado"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? '¡Copiado!' : 'Copiar JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              reset();
              toast.info('Estado reseteado');
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            title="Resetear formulario"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Live Component View (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* View Tabs */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/60 border border-slate-800 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers size={14} />
                <span>Vista en Vivo (Componente)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('payload')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                  activeTab === 'payload'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 size={14} />
                <span>Inspector de Estado & Payload</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders size={14} />
                <span>Configuración de Props</span>
              </button>
            </div>

            {/* Tab: Preview */}
            {activeTab === 'preview' && (
              <div className="rounded-3xl border border-slate-800 bg-white shadow-2xl p-6 sm:p-8 text-slate-900 overflow-hidden relative">
                <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono font-semibold uppercase tracking-wider text-[0.68rem] text-indigo-600 flex items-center gap-1">
                    <Sparkles size={12} />
                    Renderizado del Componente &lt;PlanProveedorStep /&gt;
                  </span>
                  <span>React 18 · TypeScript</span>
                </div>

                {/* Render the actual PlanProveedorStep component */}
                <PlanProveedorStep
                  title={customTitle}
                  subtitle={customSubtitle}
                  cramo={cramo}
                  centidad={centidad}
                  citem={citem}
                  onPlanSelect={(p) => setLastPlanEvent(p)}
                  onProveedorSelect={(prov) => setLastProveedorEvent(prov)}
                />
              </div>
            )}

            {/* Tab: Payload Inspector */}
            {activeTab === 'payload' && (
              <div className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Code2 size={16} className="text-indigo-400" />
                      Estado del Wizard Store (JSON Snapshot)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Este es el estado reactivo que se envía al módulo de emisión o al backend.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-bold transition-all"
                  >
                    Copiar JSON
                  </button>
                </div>

                <div className="relative rounded-2xl bg-black/60 border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-[500px]">
                  <pre className="text-emerald-400">
                    {JSON.stringify(getHandoffSnapshot(), null, 2)}
                  </pre>
                </div>

                {/* Event Tracker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <p className="text-[0.68rem] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Último Evento: onPlanSelect
                    </p>
                    {lastPlanEvent ? (
                      <div className="text-xs text-indigo-300 space-y-1">
                        <p className="font-bold">{lastPlanEvent.name}</p>
                        <p className="text-[0.7rem] text-slate-400">{lastPlanEvent.tag} · ${lastPlanEvent.priceNum}/mes</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic">No disparado aún</p>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <p className="text-[0.68rem] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Último Evento: onProveedorSelect
                    </p>
                    {lastProveedorEvent ? (
                      <div className="text-xs text-emerald-300 space-y-1">
                        <p className="font-bold">{lastProveedorEvent.xproveedor}</p>
                        <p className="text-[0.7rem] text-slate-400">RIF / ID: {lastProveedorEvent.cci_rif}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic">No disparado aún</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Settings */}
            {activeTab === 'settings' && (
              <div className="rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders size={16} className="text-indigo-400" />
                    Parámetros de Integración (Props)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modifica los parámetros enviados a &lt;PlanProveedorStep /&gt; para probar diferentes ramos o textos.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">cramo (Código de Ramo)</label>
                    <input
                      type="number"
                      value={cramo}
                      onChange={(e) => setCramo(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="text-[0.68rem] text-slate-500 mt-1 block">RCV = 18, Funerario = 9</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">centidad</label>
                    <input
                      type="number"
                      value={centidad}
                      onChange={(e) => setCentidad(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="text-[0.68rem] text-slate-500 mt-1 block">Default = 1</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">citem</label>
                    <input
                      type="number"
                      value={citem}
                      onChange={(e) => setCitem(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="text-[0.68rem] text-slate-500 mt-1 block">Default = 1</span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Título del Paso</label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Subtítulo / Instrucciones</label>
                    <input
                      type="text"
                      value={customSubtitle}
                      onChange={(e) => setCustomSubtitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Controls, Simulation & Summary (4 cols) */}
          <div className="lg:col-span-4 space-y-6">

            {/* Validation Overview Card */}
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-black uppercase tracking-wider text-slate-400">
                  Resumen de Validación
                </span>
                <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-md ${
                  isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {isComplete ? 'COMPLETO' : 'PENDIENTE'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <span className="text-slate-400 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selectedPlan ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    Plan Seleccionado:
                  </span>
                  <span className="font-bold text-white truncate max-w-[140px]">
                    {selectedPlan?.name || 'Ninguno'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <span className="text-slate-400 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selectedProveedor ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    Proveedor Asignado:
                  </span>
                  <span className="font-bold text-white truncate max-w-[140px]">
                    {selectedProveedor?.xproveedor || 'Ninguno'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Building2 size={13} className="text-indigo-400" />
                    Código cproveedor:
                  </span>
                  <span className="font-mono font-bold text-indigo-300">
                    {cproveedor ?? 'null'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Layers size={13} className="text-violet-400" />
                    Categoría Activa:
                  </span>
                  <span className="font-bold text-white capitalize">
                    {category || 'No definida'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleValidateForm}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>Validar Selección Actual</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Vehicle Simulator (Triggers auto-category & La Mundial Quotes) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Car size={14} className="text-indigo-400" />
                  Simulador de Vehículo
                </span>
                {vehicle.marca && (
                  <button
                    type="button"
                    onClick={handleClearVehicle}
                    className="text-[0.65rem] text-rose-400 hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prueba cómo el componente auto-detecta la categoría y cotiza con La Mundial según el vehículo.
              </p>

              {/* Presets */}
              <div className="space-y-2">
                {VEHICLE_PRESETS.map((preset) => {
                  const isActive =
                    vehicle.marca === preset.marca && vehicle.modelo === preset.modelo;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                        isActive
                          ? 'bg-indigo-950/70 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{preset.label}</span>
                        {isActive && <Check size={14} className="text-indigo-400" />}
                      </div>
                      <p className="text-[0.7rem] text-slate-400 mt-0.5">{preset.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Manual input simulation */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">
                  Edición Manual Rápida
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Marca"
                    value={vehicle.marca || ''}
                    onChange={(e) => setVehicle({ marca: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Modelo"
                    value={vehicle.modelo || ''}
                    onChange={(e) => setVehicle({ modelo: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Año (ej. 2021)"
                    value={vehicle.año || ''}
                    onChange={(e) => setVehicle({ año: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <select
                    value={vehicle.uso || 'Particular'}
                    onChange={(e) => setVehicle({ uso: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="Particular">Particular</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Carga">Carga</option>
                    <option value="Flota">Flota</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Links & Info */}
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/50 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                <ExternalLink size={13} />
                <span>Rutas del Validador Disponibles</span>
              </div>
              <ul className="space-y-1 text-[0.72rem] font-mono text-slate-400">
                <li>• /plan-proveedor</li>
                <li>• /test-plan-proveedor</li>
                <li>• /?view=plan-proveedor</li>
              </ul>
            </div>

          </div>

        </div>
      </main>

      <TokenManagerModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        onNavigateToView={(view) => {
          setShowTokenModal(false);
          if (view === 'validador') window.location.href = '/plan-proveedor';
          if (view === 'config') window.location.href = '/config';
          if (view === 'wizard') window.location.href = '/';
        }}
      />
    </div>
  );
}
