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
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { LabelComponent } from '../../../shared/components/label/label.component';
import { environment } from '../../../../environments/environment';

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
 * El componente también hace el redirect a issuancePortalUrl directamente
 * (equivalente al handleAuthenticated de App.tsx) para que funcione tanto
 * embebido como cargado por router.
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
  protected readonly step = signal<'select' | 'authenticate'>('select');

  /** Mock fields — eDNI flow (deshabilitado, preservado para futura activación). */
  protected readonly dni = signal('12345678A');
  protected readonly pin = signal('1234');

  /** Certificate authentication state. */
  protected readonly certData = signal<CertificateData | null>(null);
  protected readonly certError = signal<string | null>(null);
  protected readonly certLoading = signal(false);

  // ── Auth method catalogue ─────────────────────────────────────────────────
  /**
   * Métodos activos en el entorno de demo. eDNI, Cl@ve Móvil y DoctorID están
   * comentados — sólo Certificado Digital está habilitado.
   */
  protected readonly authMethods: Array<{
    id: AuthMethod;
    title: string;
    description: string;
    recommended: boolean;
  }> = [
    /* TEMPORAL: deshabilitado — sólo Certificado Digital activo
    { id: 'eDNI', title: 'DNI Electrónico',
      description: 'Autentícate usando tu DNI electrónico y un lector de tarjetas',
      recommended: false },
    */
    {
      id: 'certificate',
      title: 'Certificado Digital',
      description: 'Usa tu certificado digital instalado en este dispositivo (ej: FNMT)',
      recommended: true,
    },
    /* TEMPORAL: deshabilitado — sólo Certificado Digital activo
    { id: 'claveMobile', title: 'Cl@ve Móvil',
      description: 'Autentícate usando la aplicación Cl@ve en tu smartphone',
      recommended: false },
    { id: 'doctorId', title: 'DoctorID',
      description: 'Accede con tu credencial verificable DoctorID desde tu cartera digital',
      recommended: false },
    */
  ];

  // ── Services ──────────────────────────────────────────────────────────────
  private readonly oidcService = inject(OidcService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Listener de postMessage — equivalente al useCallback+useEffect del original React. */
  private readonly certMessageListener = (event: MessageEvent): void => {
    if (event.origin !== environment.certServerUrl) return;

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
    window.addEventListener('message', this.certMessageListener);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('message', this.certMessageListener);
    });

    /**
     * RF-001: abrir el popup de certificado automáticamente al entrar en
     * el paso 'authenticate' con método 'certificate' y sin datos previos.
     *
     * effect() requiere injection context — se pasa { injector } para llamarlo desde ngOnInit.
     */
    effect(() => {
      const s = this.step();
      const method = this.selectedMethod();
      const data = this.certData();
      const loading = this.certLoading();

      if (s === 'authenticate' && method === 'certificate' && data === null && !loading) {
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
    this.step.set('authenticate');
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
      `${environment.certServerUrl}/cert-auth?origin=${encodeURIComponent(window.location.origin)}`,
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

    const user: AuthenticatedUser = {
      id: `CERT-${sub.serialNumber ?? Date.now()}`,
      name,
      collegiateNumber: String(Math.floor(Math.random() * 900000) + 100000),
      dni: sub.serialNumber ?? '',
      email: sub.emailAddress ?? 'bernat.lopez@altia.es',
      phone: '',
      college: 'Col·legi de Metges de Barcelona',
      specialty: 'Oftalmología',
      authMethod: 'certificate',
      certificateData: cert,
    };

    this.emitAuthenticated(user);
  }

  /** Autentica con datos mock — eDNI y Cl@ve Móvil (entorno demo). */
  protected handleMockAuthenticate(): void {
    this.isAuthenticating.set(true);
    setTimeout(() => {
      const mockUser: AuthenticatedUser = {
        id: 'DR-12345',
        name: 'Dra. Maria Garcia Lopez',
        collegiateNumber: '282912345',
        dni: this.dni(),
        email: 'maria.garcia@ejemplo.com',
        phone: '+34 600 123 456',
        college: 'Colegio Oficial de Medicos de Madrid',
        specialty: 'Medicina Familiar y Comunitaria',
        authMethod: this.selectedMethod() as 'eDNI' | 'claveMobile',
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

  protected handleBack(): void {
    this.back.emit();
    window.history.length > 1
      ? window.history.back()
      : (window.location.href = '/');
  }

  protected handleGoBackToSelect(): void {
    this.step.set('select');
    this.certData.set(null);
    this.certError.set(null);
    this.certLoading.set(false);
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
    window.location.href = `${environment.issuancePortalUrl}?identified=1&u=${encoded}`;
  }
}
