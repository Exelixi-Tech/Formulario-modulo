import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FormularioConfigPanel } from './config/FormularioConfigPanel.tsx'
import bridgeReady from './lib/bridge'
import { NexusGuard } from './nexus/NexusGuard'
import { applyExelixiOcrHandoff } from './lib/exelixi-catalog'
import { applyOcrPersonRolesFromDocuments } from './lib/ocr-person-roles'
import { applyFuneralOcrCedulas } from './lib/funeral-ocr-apply'
import { isCotizadorFlow } from './lib/cotizador-flow'
import { applyExelixiBranding } from './lib/exelixi-branding'
import { useWizardStore } from './store/wizardStore'
import { isFunerario, isRcv, usesFuneralStep } from './lib/product'
import { applyMetadataFromNexusToken, getNexusTokenFromUrl } from './lib/nexus-token-client'
import { mergeMarketplaceActorMetadata, rememberMarketplaceActorFromToken } from './lib/sso-metadata'
import {
  hydrateTarjetaHandoff,
  hydrateTarjetaMetadataCanal,
  isTarjetaRcvFlow,
  isTarjetaVolver,
  markTarjetaPublicSession,
} from './lib/rcv-tarjeta-flow'
import { applyWizardStepFromUrl } from './lib/wizard-step'

// Identidad Exélixi (colores + favicon) solo si el flujo activo es el catálogo.
applyExelixiBranding('Formulario');

// Regreso desde Emisión/Pagos por el paso a paso: se restaura lo que el cliente ya llenó.
const tarjetaVolver = isTarjetaVolver() && hydrateTarjetaHandoff();

if (isTarjetaRcvFlow()) {
  markTarjetaPublicSession();
  hydrateTarjetaMetadataCanal();
  if (tarjetaVolver) {
    useWizardStore.getState().setOcrDone(true);
    applyWizardStepFromUrl(useWizardStore.getState().goTo);
  } else {
    useWizardStore.getState().setVehicle({ tipoPlaca: 'nacional', tipoCarnet: 'nacional' });
  }
}

rememberMarketplaceActorFromToken(getNexusTokenFromUrl());

applyMetadataFromNexusToken('nexus_access_token_formulario', (metadata) => {
  const store = useWizardStore.getState();
  store.setMetadataCanal(
    mergeMarketplaceActorMetadata({ ...(store.metadataCanal || {}), ...metadata }),
  );
});

function ExelixiHandoffBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const runBootstrap = () => {
      const {
        setDocState,
        setTomador,
        setVehicle,
        setOcrDone,
        setDiligencia,
        goTo,
        setSameInsured,
        setAsegurado,
        setHasDriver,
        setConductor,
      } = useWizardStore.getState();

      if (isCotizadorFlow() && isRcv()) {
        setOcrDone(true);
        if (!useWizardStore.getState().vehicle.tipoPlaca) {
          useWizardStore.getState().setVehicle({ tipoPlaca: 'nacional' });
        }
        goTo(3);
        return;
      }

      // Al volver por el paso a paso ya se restauró el estado completo: no reaplicar el OCR.
      if (tarjetaVolver) return;

      const handoffApplied = applyExelixiOcrHandoff({
        setDocState,
        setTomador,
        setVehicle,
        setOcrDone,
        setDiligencia,
        goTo,
        setSameInsured,
        setAsegurado,
        setHasDriver,
        setConductor,
      });

      if (!handoffApplied && isRcv()) {
        const store = useWizardStore.getState();
        const titularFromCarnet = (store as { titularFromCarnet?: boolean }).titularFromCarnet;
        const aseguradoId = String(store.asegurado?.identificacion ?? '').replace(/\D/g, '');
        // Bridge/OCR ya resolvió tomador≠titular — no recalcular (pisaba tipoDoc con lógica vieja).
        const rolesAlreadyHydrated =
          titularFromCarnet === true
          || (store.sameInsured === false && aseguradoId.length >= 6)
          || (store.hasDriver && Boolean(store.conductor?.identificacion));

        const latest = store.documents;
        const hasOcr =
          latest.cedula?.ocr
          || latest.licencia?.ocr
          || latest.certificado?.ocr;
        if (hasOcr && !rolesAlreadyHydrated) {
          applyOcrPersonRolesFromDocuments(latest, {
            setSameInsured,
            setAsegurado,
            setHasDriver,
            setConductor,
          });
        }
      }

      if (isFunerario() || usesFuneralStep()) {
        applyFuneralOcrCedulas();
      }
    };

    void (async () => {
      const sid = new URLSearchParams(window.location.search).get('sid');
      if (sid) {
        await bridgeReady;
        if (window.__bridge?.ready) await window.__bridge.ready;
      }
      if (cancelled) return;
      runBootstrap();
    })();

    return () => { cancelled = true; };
  }, []);
  return children;
}

// /config (dev) o /formulario/config (prod con prefijo Apache)
const isConfigRoute = /\/config\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigRoute
      ? <FormularioConfigPanel />
      : (
        <NexusGuard recheckInterval={30}>
          <ExelixiHandoffBootstrap>
            <App />
          </ExelixiHandoffBootstrap>
        </NexusGuard>
      )
    }
  </StrictMode>,
)
