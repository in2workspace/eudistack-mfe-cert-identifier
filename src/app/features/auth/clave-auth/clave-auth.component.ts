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
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';

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

/**
 * Margen tras cargar el iframe de cert-auth para recibir CERT_AUTH_PENDING o el
 * resultado; si no llega nada, el handshake mTLS ha fallado.
 */
const CERT_FRAME_LOAD_GRACE_MS = 3000;

/**
 * ClaveAuthComponent — autenticación con Certificado Digital (mTLS vía iframe oculto).
 *
 * eDNI, Cl@ve Móvil, DoctorID y Video se movieron a
 * eudistack-cgcom-mfe-issuance-portal ('identify') — solo
 * 'certificate' se queda aquí: depende del handshake mTLS + cert-server.mjs,
 * imposible de mover sin tocar ese backend.
 *
 * Migración de src/components/portal/ClaveAuthPage.tsx (React 18 + hooks)
 * a Angular 19 standalone components + signals.
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
    // Lucide icons (standalone directives svg[lucide*])
    LucideShield,
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

  /** Certificate authentication state. */
  protected readonly certData = signal<CertificateData | null>(null);
  protected readonly certError = signal<string | null>(null);
  protected readonly certLoading = signal(false);

  /** Iframe oculto que dispara el handshake mTLS (sustituye al popup). */
  private certFrame: HTMLIFrameElement | null = null;
  /** El cert-server ha confirmado que espera la selección del usuario. */
  private certPending = false;
  private certLoadCheck?: ReturnType<typeof setTimeout>;

  // ── Services ──────────────────────────────────────────────────────────────
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly branding = inject(BrandingService);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Origen del iframe de cert-auth. En STG es environment.certServerUrl, un
   * host ALB-bypass dedicado (puerto mTLS aparte) para que el navegador
   * llegue realmente al listener mTLS del ALB. En local no hay tal bypass
   * (mismo nginx sirve /issuance-portal/ para cualquier subdominio de tenant), así
   * que certServerUrl viene vacío y se cae al origin actual (AD-2).
   */
  private certServerOrigin(): string {
    return environment.certServerUrl || window.location.origin;
  }

  /** Listener de postMessage — equivalente al useCallback+useEffect del original React. */
  private readonly certMessageListener = (event: MessageEvent): void => {
    if (event.origin !== this.certServerOrigin()) return;

    if (event.data?.type === 'CERT_AUTH_PENDING') {
      this.certPending = true;
    } else if (event.data?.type === 'CERT_AUTH_SUCCESS') {
      this.certData.set(event.data.data as CertificateData);
      this.certLoading.set(false);
      this.certError.set(null);
      this.removeCertFrame();
    } else if (event.data?.type === 'CERT_AUTH_ERROR') {
      this.failCertificateRead(event.data.error ?? 'Error desconocido');
    }
  };

  ngOnInit(): void {
    // La selección de método vive ahora en eudistack-cgcom-mfe-issuance-portal
    // ('identify'); se llega aquí siempre con ?method=certificate ya
    // elegido — es el único método que queda en este repo.
    const params = new URLSearchParams(window.location.search);
    const method = params.get('method');
    if (method !== 'certificate') {
      window.location.href = '/issuance-portal/identify';
      return;
    }
    this.selectedMethod.set('certificate');

    window.addEventListener('message', this.certMessageListener);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('message', this.certMessageListener);
      this.removeCertFrame();
    });

    /**
     * RF-001: lanzar el selector de certificado automáticamente al entrar sin
     * datos previos.
     *
     * effect() requiere injection context — se pasa { injector } para llamarlo desde ngOnInit.
     */
    effect(() => {
      const data = this.certData();
      const loading = this.certLoading();
      const error = this.certError();

      // Only auto-launch the certificate selector on first entry (no prior error).
      // Without the error guard the effect re-fires after every failure,
      // creating a silent tight loop (failure → !loading → effect → ...).
      if (data === null && !loading && error === null) {
        this.handleCertificateSelect();
      }
    }, { injector: this.injector });
  }

  ngOnDestroy(): void {
    // El removeEventListener queda registrado vía destroyRef.onDestroy() en ngOnInit.
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Lanza la lectura del certificado en un iframe oculto hacia el cert-server:
   * el navegador muestra directamente su selector de certificado (handshake
   * mTLS) sin ventana emergente intermedia. El resultado llega por
   * postMessage (certMessageListener).
   */
  protected handleCertificateSelect(): void {
    this.certLoading.set(true);
    this.certError.set(null);
    this.certData.set(null);
    this.certPending = false;
    this.removeCertFrame();

    const frame = document.createElement('iframe');
    frame.title = 'cert-auth';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.display = 'none';
    frame.src =
      `${this.certServerOrigin()}/issuance-portal/api/cert-auth` +
      `?origin=${encodeURIComponent(window.location.origin)}&t=${Date.now()}`;

    // Si el iframe carga pero no anuncia que espera la selección
    // (CERT_AUTH_PENDING) ni devuelve resultado, el handshake mTLS falló
    // (selección cancelada, sin certificado, error de red).
    frame.addEventListener('load', () => {
      clearTimeout(this.certLoadCheck);
      this.certLoadCheck = setTimeout(() => {
        if (this.certLoading() && !this.certPending) {
          this.failCertificateRead(
            'No se pudo completar la lectura del certificado. ' +
              'Verifica que tienes un certificado digital instalado.',
          );
        }
      }, CERT_FRAME_LOAD_GRACE_MS);
    });

    document.body.appendChild(frame);
    this.certFrame = frame;
  }

  private failCertificateRead(error: string): void {
    this.certError.set(error);
    this.certLoading.set(false);
    this.removeCertFrame();
  }

  private removeCertFrame(): void {
    clearTimeout(this.certLoadCheck);
    this.certFrame?.remove();
    this.certFrame = null;
  }

  /** Autentica con los datos del certificado leído. */
  protected handleAuthenticate(): void {
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

  protected handleBack(): void {
    this.back.emit();
    window.history.length > 1
      ? window.history.back()
      : (window.location.href = '/');
  }

  /**
   * La selección de método vive ahora en eudistack-cgcom-mfe-issuance-portal
   * ('identify') — "cambiar método"/"cancelar" ya no es un estado
   * local, es volver a esa pantalla (same-origin, cross-app).
   */
  protected goToMethodSelection(): void {
    window.location.href = '/issuance-portal/identify';
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
    window.location.href = `/issuance-portal/?identified=1&u=${encoded}`;
  }
}
