import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClaveAuthComponent } from './clave-auth.component';
import { CertificateData } from '../../../core/models/auth.model';

const CERT: CertificateData = {
  subject: { commonName: 'MARIA GARCIA LOPEZ', serialNumber: '12345678Z' },
  issuer: { commonName: 'AC FNMT Usuarios', organization: 'FNMT-RCM' },
  validFrom: '2025-01-01T00:00:00Z',
  validTo: '2029-01-01T00:00:00Z',
  certificateType: 'personal',
};

/** Acceso a los miembros protected del componente desde el test. */
interface ClaveAuthInternals {
  certData(): CertificateData | null;
  certError(): string | null;
  certLoading(): boolean;
  handleCertificateSelect(): void;
}

function certFrames(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[title="cert-auth"]'));
}

/** Simula un postMessage del iframe de cert-auth en curso (o de `source`, si se indica). */
function postFromCertServer(
  data: unknown,
  origin = window.location.origin,
  source: Window | null = certFrames()[0]?.contentWindow ?? null,
): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
}

describe('ClaveAuthComponent', () => {
  let fixture: ComponentFixture<ClaveAuthComponent>;
  let component: ClaveAuthInternals;

  beforeEach(async () => {
    jest.useFakeTimers();
    window.history.pushState({}, '', '/cert/?method=certificate');

    await TestBed.configureTestingModule({
      imports: [ClaveAuthComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaveAuthComponent);
    component = fixture.componentInstance as unknown as ClaveAuthInternals;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  it('lanza el selector al entrar con un iframe oculto, sin abrir ventana emergente', () => {
    const openSpy = jest.spyOn(window, 'open');

    const frames = certFrames();
    expect(frames).toHaveLength(1);
    expect(frames[0].style.display).toBe('none');
    expect(frames[0].getAttribute('aria-hidden')).toBe('true');
    expect(frames[0].src).toContain('/issuance-portal/api/cert-auth?origin=');
    expect(frames[0].src).toContain(encodeURIComponent(window.location.origin));
    expect(component.certLoading()).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('guarda los datos del certificado y retira el iframe al recibir CERT_AUTH_SUCCESS', () => {
    postFromCertServer({ type: 'CERT_AUTH_SUCCESS', data: CERT });

    expect(component.certData()).toEqual(CERT);
    expect(component.certLoading()).toBe(false);
    expect(component.certError()).toBeNull();
    expect(certFrames()).toHaveLength(0);
  });

  it('muestra el error y retira el iframe al recibir CERT_AUTH_ERROR', () => {
    postFromCertServer({ type: 'CERT_AUTH_ERROR', error: 'No se ha proporcionado certificado' });

    expect(component.certError()).toBe('No se ha proporcionado certificado');
    expect(component.certLoading()).toBe(false);
    expect(certFrames()).toHaveLength(0);
  });

  it('usa un mensaje genérico si CERT_AUTH_ERROR no trae detalle', () => {
    postFromCertServer({ type: 'CERT_AUTH_ERROR' });

    expect(component.certError()).toBe('Error desconocido');
  });

  it('ignora mensajes de otros orígenes', () => {
    postFromCertServer({ type: 'CERT_AUTH_SUCCESS', data: CERT }, 'https://evil.example');

    expect(component.certData()).toBeNull();
    expect(component.certLoading()).toBe(true);
    expect(certFrames()).toHaveLength(1);
  });

  it('ignora mensajes del mismo origen que no vienen del iframe de cert-auth', () => {
    postFromCertServer({ type: 'CERT_AUTH_SUCCESS', data: CERT }, window.location.origin, window);

    expect(component.certData()).toBeNull();
    expect(component.certLoading()).toBe(true);
    expect(certFrames()).toHaveLength(1);
  });

  it('da el handshake por fallido si el iframe carga sin anunciar CERT_AUTH_PENDING', () => {
    certFrames()[0].dispatchEvent(new Event('load'));
    jest.advanceTimersByTime(3000);

    expect(component.certLoading()).toBe(false);
    expect(component.certError()).toContain('No se pudo completar la lectura del certificado');
    expect(certFrames()).toHaveLength(0);
  });

  it('sigue esperando la selección si el cert-server anuncia CERT_AUTH_PENDING', () => {
    postFromCertServer({ type: 'CERT_AUTH_PENDING' });
    certFrames()[0].dispatchEvent(new Event('load'));
    jest.advanceTimersByTime(3000);

    expect(component.certLoading()).toBe(true);
    expect(component.certError()).toBeNull();
    expect(certFrames()).toHaveLength(1);
  });

  it('no marca error si el resultado llega antes de agotar el margen tras la carga', () => {
    certFrames()[0].dispatchEvent(new Event('load'));
    postFromCertServer({ type: 'CERT_AUTH_SUCCESS', data: CERT });
    jest.advanceTimersByTime(3000);

    expect(component.certData()).toEqual(CERT);
    expect(component.certError()).toBeNull();
  });

  it('reintentar sustituye el iframe anterior por uno nuevo', () => {
    postFromCertServer({ type: 'CERT_AUTH_ERROR', error: 'cancelado' });
    component.handleCertificateSelect();

    expect(certFrames()).toHaveLength(1);
    expect(component.certLoading()).toBe(true);
    expect(component.certError()).toBeNull();
  });

  it('no relanza el selector automáticamente tras un error', () => {
    postFromCertServer({ type: 'CERT_AUTH_ERROR', error: 'cancelado' });
    fixture.detectChanges();

    expect(certFrames()).toHaveLength(0);
    expect(component.certLoading()).toBe(false);
  });

  it('retira el iframe y deja de escuchar mensajes al destruirse', () => {
    fixture.destroy();

    expect(certFrames()).toHaveLength(0);
    postFromCertServer({ type: 'CERT_AUTH_SUCCESS', data: CERT });
    expect(component.certData()).toBeNull();
  });
});
