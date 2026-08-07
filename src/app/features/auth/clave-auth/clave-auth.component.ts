import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  Injector,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  LucideShield,
  LucideCreditCard,
  LucideSmartphone,
  LucideVideo,
  LucideMic,
  LucidePhoneOff,
  LucideArrowLeft,
  LucideChevronRight,
  LucideCheckCircle,
  LucideLoader2,
  LucideAlertCircle,
  LucideExternalLink,
  LucideUser,
  LucideBuilding,
  LucideCalendar,
  LucideFingerprint,
} from '@lucide/angular';

import { AuthMethod, AuthenticatedUser, CertificateData } from '../../../core/models/auth.model';
import { OidcService } from '../../../core/services/oidc.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { LabelComponent } from '../../../shared/components/label/label.component';

/** Perfil demo por tenant (nombre/departamento/puesto): CGCOM emite para médicos colegiados; el resto, para empleados del grupo. */
interface DemoProfile {
  mockId: string;
  mockName: string;
  mockEmail: string;
  college: string;
  specialty: string;
}

const DOCTOR_DEMO_PROFILE: DemoProfile = {
  mockId: 'DR-12345',
  mockName: 'Dra. Maria Garcia Lopez',
  mockEmail: 'maria.garcia@ejemplo.com',
  college: 'Col·legi de Metges de Barcelona',
  specialty: 'Oftalmología',
};

const EMPLOYEE_DEMO_PROFILE: DemoProfile = {
  mockId: 'EMP-12345',
  mockName: 'María García López',
  mockEmail: 'maria.garcia@altia.es',
  college: 'Altia Consultoría y Tecnología',
  specialty: 'Consultor de Tecnología',
};

const CALIDALIA_DEMO_PROFILE: DemoProfile = {
  ...EMPLOYEE_DEMO_PROFILE,
  college: 'Gallo',
  specialty: 'Responsable de Calidad',
};

/** Perfiles demo por tenant específico; el resto de tenants cae al genérico de empleado. */
const DEMO_PROFILES_BY_TENANT: Record<string, DemoProfile> = {
  cgcom: DOCTOR_DEMO_PROFILE,
  calidalia: CALIDALIA_DEMO_PROFILE,
};

function resolveDemoProfile(): DemoProfile {
  const tenant = resolveTenantIdentity(window.location, environment);
  return (tenant && DEMO_PROFILES_BY_TENANT[tenant]) || EMPLOYEE_DEMO_PROFILE;
}

/** Único tenant con emisión DoctorID hoy; el resto ve la credencial genérica de empleado (mismo criterio que el Portal de Emisión). */
function resolveCredentialLabel(): string {
  return resolveTenantIdentity(window.location, environment) === 'cgcom' ? 'DoctorID' : 'EmployeeID';
}

/**
 * ClaveAuthComponent — componente principal de identificación.
 *
 * Migración de src/components/portal/ClaveAuthPage.tsx (React 18 + hooks)
 * a Angular 19 standalone components + signals.
 *
 * Mapa de conversión React → Angular:
 *   useState<T>              → signal<T>()
 *   useEffect([deps])        → effect() — re-ejecuta con signals leídas en su cuerpo
 *   useCallback              → método de clase (Angular no necesita memoización)
 *   onAuthenticate (prop)    → @Output() authenticated
 *   onBack (prop)            → @Output() back  +  window.history.back() interno
 *
 * El componente también hace el redirect a /identify/portal (same-origin)
 * directamente (equivalente al handleAuthenticated de App.tsx) para que
 * funcione tanto embebido como cargado por router.
 *
 * Iconos: @lucide/angular — directivas standalone svg[lucide*].
 */
@Component({
  selector: 'app-clave-auth',
  standalone: true,
  imports: [
    // UI primitives
    ButtonComponent,
    CardComponent,
    InputComponent,
    LabelComponent,
    // Lucide icons (standalone directives svg[lucide*])
    LucideShield,
    LucideCreditCard,
    LucideSmartphone,
    LucideVideo,
    LucideMic,
    LucidePhoneOff,
    LucideArrowLeft,
    LucideChevronRight,
    LucideCheckCircle,
    LucideLoader2,
    LucideAlertCircle,
    LucideExternalLink,
    LucideUser,
    LucideBuilding,
    LucideCalendar,
    LucideFingerprint,
  ],
  templateUrl: './clave-auth.component.html',
})
export class ClaveAuthComponent implements OnInit, OnDestroy {
  // ── Outputs ───────────────────────────────────────────────────────────────
  /** Emitido cuando el usuario completa la autenticación. */
  readonly authenticated = output<AuthenticatedUser>();
  /** Emitido cuando el usuario pulsa "atrás" en la pantalla de selección. */
  readonly back = output<void>();

  // ── State (signals) ───────────────────────────────────────────────────────
  protected readonly selectedMethod = signal<AuthMethod | null>(null);
  protected readonly isAuthenticating = signal(false);

  /** Mock fields — eDNI flow (deshabilitado, preservado para futura activación). */
  protected readonly dni = signal('12345678A');
  protected readonly pin = signal('1234');

  /** Certificate authentication state. */
  protected readonly certData = signal<CertificateData | null>(null);
  protected readonly certError = signal<string | null>(null);
  protected readonly certLoading = signal(false);

  /** DoctorID OIDC callback state. */
  protected readonly doctorIdLoading = signal(false);
  protected readonly doctorIdError = signal<string | null>(null);

  /** DoctorID para CGCOM, EmployeeID para el resto de tenants. */
  protected readonly credentialLabel = resolveCredentialLabel();

  // ── Auth method catalogue ─────────────────────────────────────────────────
  /**
   * Métodos activos en el entorno de demo. eDNI, Cl@ve Móvil y DoctorID/EmployeeID
   * están comentados — sólo Certificado Digital está habilitado.
   */
  protected readonly authMethods: Array<{
    id: AuthMethod;
    title: string;
    description: string;
    recommended: boolean;
  }> = [
    { id: 'eDNI', title: 'DNI Electrónico',
      description: 'Autentícate usando tu DNI electrónico y un lector de tarjetas',
      recommended: false },
    {
      id: 'certificate',
      title: 'Certificado Digital',
      description: 'Usa tu certificado digital instalado en este dispositivo (ej: FNMT)',
      recommended: true,
    },
    { id: 'claveMobile', title: 'Cl@ve Móvil',
      description: 'Autentícate usando la aplicación Cl@ve en tu smartphone',
      recommended: false },
    { id: 'doctorId', title: this.credentialLabel,
      description: `Accede con tu credencial verificable ${this.credentialLabel} desde tu cartera digital`,
      recommended: false },
    { id: 'video', title: 'Video Identificación',
      description: 'Identifícate en tiempo real con un agente verificador mediante videollamada',
      recommended: false },
  ];

  // ── Services ──────────────────────────────────────────────────────────────
  private readonly oidcService = inject(OidcService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly branding = inject(BrandingService);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Origen del popup de cert-auth. En STG es environment.certServerUrl, un
   * host ALB-bypass dedicado (puerto mTLS aparte) para que el navegador
   * llegue realmente al listener mTLS del ALB. En local no hay tal bypass
   * (mismo nginx sirve /identify/ para cualquier subdominio de tenant), así
   * que certServerUrl viene vacío y se cae al origin actual (AD-2).
   */
  private certServerOrigin(): string {
    return environment.certServerUrl || window.location.origin;
  }

  /** Listener de postMessage — equivalente al useCallback+useEffect del original React. */
  private readonly certMessageListener = (event: MessageEvent): void => {
    if (event.origin !== this.certServerOrigin()) return;

    if (event.data?.type === 'CERT_AUTH_SUCCESS') {
      this.certData.set(event.data.data as CertificateData);
      this.certLoading.set(false);
      this.certError.set(null);
    } else if (event.data?.type === 'CERT_AUTH_ERROR') {
      this.certError.set(event.data.error ?? 'Error desconocido');
      this.certLoading.set(false);
    }
  };

  ngOnInit(): void {
    // Detect OIDC callback from DoctorID verifier flow
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      this.handleOidcCallback(code, state);
      return;
    }

    // La selección de método vive ahora en eudistack-cgcom-mfe-issuance-portal
    // ('portal/identify'); se llega aquí siempre con ?method=<id> ya elegido.
    // Sin método válido no hay nada que mostrar — se redirige de vuelta.
    const method = params.get('method') as AuthMethod | null;
    if (!method || !this.authMethods.some((m) => m.id === method)) {
      window.location.href = '/identify/portal/identify';
      return;
    }
    this.handleSelectMethod(method);

    window.addEventListener('message', this.certMessageListener);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('message', this.certMessageListener);
    });

    /**
     * RF-001: abrir el popup de certificado automáticamente al entrar con
     * método 'certificate' y sin datos previos.
     *
     * effect() requiere injection context — se pasa { injector } para llamarlo desde ngOnInit.
     */
    effect(() => {
      const selected = this.selectedMethod();
      const data = this.certData();
      const loading = this.certLoading();
      const error = this.certError();

      // Only auto-open the popup on first entry (no prior error).
      // Without the error guard the effect re-fires after every failure,
      // creating a silent tight loop in Edge (popup blocker returns null → !loading → effect → ...).
      if (selected === 'certificate' && data === null && !loading && error === null) {
        this.handleCertificateSelect();
      }
    }, { injector: this.injector });
  }

  ngOnDestroy(): void {
    // El removeEventListener queda registrado vía destroyRef.onDestroy() en ngOnInit.
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  protected handleSelectMethod(method: AuthMethod): void {
    if (method === 'doctorId') {
      this.oidcService.iniciarFlujoOIDCPortal();
      return;
    }
    this.selectedMethod.set(method);
    this.certData.set(null);
    this.certError.set(null);
    this.certLoading.set(false);
  }

  /** Abre el popup mTLS hacia el cert-server para lectura del certificado. */
  protected handleCertificateSelect(): void {
    this.certLoading.set(true);
    this.certError.set(null);
    this.certData.set(null);

    const popupWidth = 520;
    const popupHeight = 420;
    const left = Math.round(window.screenX + (window.innerWidth - popupWidth) / 2);
    const top = Math.round(window.screenY + (window.innerHeight - popupHeight) / 2);

    const popup = window.open(
      `${this.certServerOrigin()}/identify/api/cert-auth?origin=${encodeURIComponent(window.location.origin)}`,
      'cert-auth',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );

    if (!popup) {
      this.certError.set(
        'No se pudo abrir la ventana de selección de certificado. ' +
          'Comprueba que las ventanas emergentes están habilitadas en tu navegador.',
      );
      this.certLoading.set(false);
      return;
    }

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        if (this.certLoading()) {
          this.certError.set(
            'La ventana de selección de certificado se ha cerrado sin completar la autenticación.',
          );
          this.certLoading.set(false);
        }
      }
    }, 500);
  }

  /** Autentica con los datos del certificado leído. */
  protected handleCertificateAuthenticate(): void {
    const cert = this.certData();
    if (!cert) return;

    this.isAuthenticating.set(true);
    const sub = cert.subject;
    const name =
      sub.commonName ||
      [sub.givenName, sub.surname].filter(Boolean).join(' ') ||
      'Desconocido';

    const profile = resolveDemoProfile();
    const user: AuthenticatedUser = {
      id: `CERT-${sub.serialNumber ?? Date.now()}`,
      name,
      collegiateNumber: String(Math.floor(Math.random() * 900000) + 100000),
      dni: sub.serialNumber ?? '',
      email: sub.emailAddress ?? 'bernat.lopez@altia.es',
      phone: '',
      college: profile.college,
      specialty: profile.specialty,
      authMethod: 'certificate',
      certificateData: cert,
    };

    this.emitAuthenticated(user);
  }

  /** Autentica con datos mock — eDNI y Cl@ve Móvil (entorno demo). */
  protected handleMockAuthenticate(): void {
    this.isAuthenticating.set(true);
    const profile = resolveDemoProfile();
    setTimeout(() => {
      const mockUser: AuthenticatedUser = {
        id: profile.mockId,
        name: profile.mockName,
        collegiateNumber: '282912345',
        dni: this.dni(),
        email: profile.mockEmail,
        phone: '+34 600 123 456',
        college: profile.college,
        specialty: profile.specialty,
        authMethod: this.selectedMethod() as 'eDNI' | 'claveMobile' | 'video',
      };
      this.emitAuthenticated(mockUser);
    }, 2000);
  }

  protected handleAuthenticate(): void {
    if (this.selectedMethod() === 'certificate') {
      this.handleCertificateAuthenticate();
    } else {
      this.handleMockAuthenticate();
    }
  }

  private handleOidcCallback(code: string, state: string): void {
    const savedState = sessionStorage.getItem('oidc_state');
    if (state !== savedState) {
      this.doctorIdError.set('Error de seguridad: state no coincide. Por favor, inicia el proceso de nuevo.');
      this.selectedMethod.set('doctorId');
      return;
    }

    // Clean URL without triggering navigation
    history.replaceState({}, '', window.location.pathname);

    this.selectedMethod.set('doctorId');
    this.doctorIdLoading.set(true);
    this.doctorIdError.set(null);

    this.oidcService.completarFlujoOIDCPortal(code).then(user => {
      this.emitAuthenticated(user);
    }).catch((err: unknown) => {
      this.doctorIdLoading.set(false);
      this.doctorIdError.set(
        err instanceof Error ? err.message : `Error al completar la autenticación con ${this.credentialLabel}.`
      );
    });
  }

  protected handleBack(): void {
    this.back.emit();
    window.history.length > 1
      ? window.history.back()
      : (window.location.href = '/');
  }

  /**
   * La selección de método vive ahora en eudistack-cgcom-mfe-issuance-portal
   * ('portal/identify') — "cambiar método"/"cancelar" ya no es un estado
   * local, es volver a esa pantalla (same-origin, cross-app).
   */
  protected goToMethodSelection(): void {
    window.location.href = '/identify/portal/identify';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  protected formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }

  /**
   * Emite el evento `authenticated` y redirige al Portal de Emisión.
   *
   * TEMPORAL: el handoff usa querystring Base64, igual que en el React original.
   * No es el diseño final — ver EUDISTACK-622.
   */
  private emitAuthenticated(user: AuthenticatedUser): void {
    this.authenticated.emit(user);
    const encoded = btoa(encodeURIComponent(JSON.stringify(user)));
    window.location.href = `/identify/portal?identified=1&u=${encoded}`;
  }
}
