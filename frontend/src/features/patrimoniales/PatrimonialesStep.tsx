import { useState, useEffect, useCallback } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input, Select, Textarea } from '../../components/ui/FormField';
import { SectionCard } from '../emission/EmissionStep';
import { Building2, Info } from 'lucide-react';
import { toast } from '../../store/toastStore';
import type { PatrimonialesData } from '../../types';

interface PatrimonialesErrors {
  datosBien?: string;
  tipo?: string;
  descripcion?: string;
}

const TIPO_OPTIONS = [
  { value: 'Residencial', label: 'Residencial' },
  { value: 'Areas comunes', label: 'Áreas comunes' },
];

export function PatrimonialesStep() {
  const patrimoniales = useWizardStore((s) => s.patrimoniales);
  const setPatrimoniales = useWizardStore((s) => s.setPatrimoniales);

  const [errors, setErrors] = useState<PatrimonialesErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (field: keyof PatrimonialesData, value: string): string | undefined => {
    const val = (value || '').trim();
    switch (field) {
      case 'datosBien':
        if (!val) return 'El campo Datos del Bien es obligatorio.';
        if (val.length > 120) return 'Máximo 120 caracteres.';
        return undefined;
      case 'tipo':
        if (!val) return 'Debes seleccionar un tipo de bien.';
        return undefined;
      case 'descripcion':
        if (!val) return 'La descripción del bien es obligatoria.';
        if (val.length > 240) return 'Máximo 240 caracteres.';
        return undefined;
      default:
        return undefined;
    }
  };

  const validateAll = useCallback((): boolean => {
    const nextErrors: PatrimonialesErrors = {};
    const eDatos = validateField('datosBien', patrimoniales.datosBien);
    if (eDatos) nextErrors.datosBien = eDatos;

    const eTipo = validateField('tipo', patrimoniales.tipo);
    if (eTipo) nextErrors.tipo = eTipo;

    const eDesc = validateField('descripcion', patrimoniales.descripcion);
    if (eDesc) nextErrors.descripcion = eDesc;

    setErrors(nextErrors);
    setTouched({ datosBien: true, tipo: true, descripcion: true });

    if (Object.keys(nextErrors).length > 0) {
      const firstError = nextErrors.datosBien || nextErrors.tipo || nextErrors.descripcion;
      toast.warning('Campos incompletos', firstError || 'Por favor completa los campos obligatorios.');
      return false;
    }
    return true;
  }, [patrimoniales]);

  // Exponer validación al flujo del Wizard en App.tsx (__validateStep3)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__validateStep3 = validateAll;
    (window as unknown as Record<string, unknown>).__validatePatrimonialesStep = validateAll;
    return () => {
      delete (window as unknown as Record<string, unknown>).__validateStep3;
      delete (window as unknown as Record<string, unknown>).__validatePatrimonialesStep;
    };
  }, [validateAll]);

  const handleChange = (field: keyof PatrimonialesData, value: string) => {
    setPatrimoniales({ [field]: value });
    if (touched[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: validateField(field, value),
      }));
    }
  };

  const handleBlur = (field: keyof PatrimonialesData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({
      ...prev,
      [field]: validateField(field, patrimoniales[field] || ''),
    }));
  };

  const isComplete = Boolean(
    patrimoniales.datosBien.trim() &&
    patrimoniales.tipo.trim() &&
    patrimoniales.descripcion.trim() &&
    !errors.datosBien &&
    !errors.tipo &&
    !errors.descripcion
  );

  return (
    <div className="space-y-6">
      <SectionCard
        title="Datos del Bien Asegurado"
        description="Información básica, tipo y descripción del bien o inmueble a asegurar."
        Icon={Building2}
        statusLabel={isComplete ? 'Completado' : 'Requerido'}
        statusTone={isComplete ? 'success' : 'neutral'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. Datos del Bien (max 120 char) */}
          <Field
            label="Datos del Bien *"
            error={errors.datosBien}
            hint={`Nombre o identificación del bien (${(patrimoniales.datosBien || '').length}/120)`}
            anchor="cli-datosBien"
          >
            <Input
              type="text"
              value={patrimoniales.datosBien || ''}
              maxLength={120}
              placeholder="Ej. Apartamento Residencial, Local comercial, Inmueble..."
              onChange={(e) => handleChange('datosBien', e.target.value.slice(0, 120))}
              onBlur={() => handleBlur('datosBien')}
              className={errors.datosBien ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}
            />
          </Field>

          {/* 2. Tipo (Select) */}
          <Field
            label="Tipo *"
            error={errors.tipo}
            hint="Selecciona la clasificación del bien"
            anchor="cli-tipo"
          >
            <Select
              value={patrimoniales.tipo || ''}
              onChange={(e) => handleChange('tipo', e.target.value)}
              onBlur={() => handleBlur('tipo')}
              className={errors.tipo ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}
            >
              <option value="">— Seleccionar tipo —</option>
              {TIPO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          {/* 3. Descripción (max 240 char) */}
          <Field
            label="Descripción *"
            error={errors.descripcion}
            hint={`Detalles y características relevantes (${(patrimoniales.descripcion || '').length}/240)`}
            full
            anchor="cli-descripcion"
          >
            <Textarea
              rows={3}
              value={patrimoniales.descripcion || ''}
              maxLength={240}
              placeholder="Describe las características principales del bien asegurado, ubicación o detalles específicos..."
              onChange={(e) => handleChange('descripcion', e.target.value.slice(0, 240))}
              onBlur={() => handleBlur('descripcion')}
              className={errors.descripcion ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}
            />
          </Field>
        </div>

        {/* Resumen o feedback */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-slate-600 text-xs">
          <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-800">Información del Bien Asegurado</p>
            <p className="text-slate-500 mt-0.5 leading-relaxed">
              Asegúrate de que los datos correspondan fielmente al inmueble o bien patrimonial objeto de la póliza para garantizar la cobertura adecuada.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export const BienStep = PatrimonialesStep;
