import { useState, useEffect, useCallback } from 'react';
import { Shield, CreditCard, Smartphone, ArrowLeft, ChevronRight, CheckCircle, Loader2, AlertCircle, ExternalLink, User, Building, Calendar, Fingerprint } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { AuthenticatedUser, CertificateData } from '../../types';

interface ClaveAuthPageProps {
  onAuthenticate: (user: AuthenticatedUser) => void;
  onBack: () => void;
}

type AuthMethod = 'eDNI' | 'certificate' | 'claveMobile' | 'doctorId' | null;

const CERT_SERVER_URL = import.meta.env.VITE_CERT_SERVER_URL || 'https://localhost:3443';

// --- OIDC DoctorID ---
const OIDC_AUTHORIZATION_ENDPOINT = 'https://cgcom.stg.eudistack.net/verifier/oidc/authorize';
const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'vc-auth-client-cgcom';
const OIDC_PORTAL_REDIRECT_URI = import.meta.env.VITE_OIDC_PORTAL_REDIRECT_URI ?? 'http://localhost:3001/portal';
const OIDC_SCOPE = 'openid profile email offline_access learcredential role';

function toBase64UrlSafe(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function iniciarFlujoOIDCPortal(): Promise<void> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = toBase64UrlSafe(verifierBytes);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = toBase64UrlSafe(digest);

  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = toBase64UrlSafe(stateBytes);

  try {
    sessionStorage.setItem('oidc_code_verifier', codeVerifier);
    sessionStorage.setItem('oidc_state', state);
  } catch { return; }

  const authUrl = new URL(OIDC_AUTHORIZATION_ENDPOINT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', OIDC_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', OIDC_PORTAL_REDIRECT_URI);
  authUrl.searchParams.set('scope', OIDC_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.href = authUrl.toString();
}

export function ClaveAuthPage({ onAuthenticate, onBack }: ClaveAuthPageProps) {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [step, setStep] = useState<'select' | 'authenticate'>('select');

  // Mock DNI para autenticación eDNI
  const [dni, setDni] = useState('12345678A');
  const [pin, setPin] = useState('1234');

  // Certificate authentication state
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  const handleSelectMethod = (method: AuthMethod) => {
    // DoctorID: iniciar flujo OIDC directamente (redirección al IdP)
    if (method === 'doctorId') {
      iniciarFlujoOIDCPortal();
      return;
    }
    setSelectedMethod(method);
    setStep('authenticate');
    // Reset certificate state when changing method
    setCertData(null);
    setCertError(null);
    setCertLoading(false);
  };

  // Listen for postMessage from certificate server popup
  const handleCertMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== CERT_SERVER_URL) return;

    if (event.data?.type === 'CERT_AUTH_SUCCESS') {
      setCertData(event.data.data as CertificateData);
      setCertLoading(false);
      setCertError(null);
    } else if (event.data?.type === 'CERT_AUTH_ERROR') {
      setCertError(event.data.error || 'Error desconocido');
      setCertLoading(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleCertMessage);
    return () => window.removeEventListener('message', handleCertMessage);
  }, [handleCertMessage]);

  // RF-001: Abrir el popup de certificado automáticamente al entrar en el paso 'authenticate'
  // con selectedMethod === 'certificate' y sin datos previos.
  // certLoading se excluye intencionalmente de las dependencias: su rol es de guarda
  // (evitar doble disparo en el render intermedio en que certLoading pasa de false a true),
  // no de trigger. Incluirla causaría el bucle: efecto → certLoading=true → re-ejecución → efecto.
  // handleCertificateSelect se excluye porque no está envuelta en useCallback; incluirla
  // dispararía el efecto en cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (
      step === 'authenticate' &&
      selectedMethod === 'certificate' &&
      certData === null &&
      !certLoading
    ) {
      handleCertificateSelect();
    }
  }, [step, selectedMethod, certData]);

  // Open popup to certificate server for mTLS handshake
  const handleCertificateSelect = () => {
    setCertLoading(true);
    setCertError(null);
    setCertData(null);

    const popupWidth = 520;
    const popupHeight = 420;
    const left = Math.round(window.screenX + (window.innerWidth - popupWidth) / 2);
    const top = Math.round(window.screenY + (window.innerHeight - popupHeight) / 2);

    const popup = window.open(
      `${CERT_SERVER_URL}/cert-auth?origin=${encodeURIComponent(window.location.origin)}`,
      'cert-auth',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );

    if (!popup) {
      setCertError(
        'No se pudo abrir la ventana de selección de certificado. Comprueba que las ventanas emergentes están habilitadas en tu navegador.',
      );
      setCertLoading(false);
      return;
    }

    // Detect if user closes the popup without completing
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        // Only set error if we haven't received data yet
        setCertLoading((loading) => {
          if (loading) {
            setCertError('La ventana de selección de certificado se ha cerrado sin completar la autenticación.');
          }
          return false;
        });
      }
    }, 500);
  };

  // Authenticate with certificate data
  const handleCertificateAuthenticate = () => {
    if (!certData) return;
    setIsAuthenticating(true);

    const sub = certData.subject;
    const name =
      sub.commonName ||
      [sub.givenName, sub.surname].filter(Boolean).join(' ') ||
      'Desconocido';

    const user: AuthenticatedUser = {
      id: `CERT-${sub.serialNumber || Date.now()}`,
      name,
      collegiateNumber: String(Math.floor(Math.random() * 900000) + 100000),
      dni: sub.serialNumber || '',
      email: sub.emailAddress || 'bernat.lopez@altia.es',
      phone: '',
      college: 'Col·legi de Metges de Barcelona',
      specialty: 'Oftalmología',
      authMethod: 'certificate',
      certificateData: certData,
    };

    onAuthenticate(user);
  };

  // Authenticate with mock data (eDNI / Cl@ve Movil)
  const handleMockAuthenticate = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      const mockUser: AuthenticatedUser = {
        id: 'DR-12345',
        name: 'Dra. Maria Garcia Lopez',
        collegiateNumber: '282912345',
        dni: dni,
        email: 'maria.garcia@ejemplo.com',
        phone: '+34 600 123 456',
        college: 'Colegio Oficial de Medicos de Madrid',
        specialty: 'Medicina Familiar y Comunitaria',
        authMethod: selectedMethod!,
      };
      onAuthenticate(mockUser);
    }, 2000);
  };

  const handleAuthenticate = () => {
    if (selectedMethod === 'certificate') {
      handleCertificateAuthenticate();
    } else {
      handleMockAuthenticate();
    }
  };

  // Format date for display
  const formatDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  const authMethods = [
    /* TEMPORAL: deshabilitado para pruebas — solo Certificado Digital activo
    {
      id: 'eDNI' as AuthMethod,
      icon: CreditCard,
      title: 'DNI Electrónico',
      description: 'Autentícate usando tu DNI electrónico y un lector de tarjetas',
      recommended: false,
    },
    */
    {
      id: 'certificate' as AuthMethod,
      icon: Shield,
      title: 'Certificado Digital',
      description: 'Usa tu certificado digital instalado en este dispositivo (ej: FNMT)',
      recommended: true,
    },
    /* TEMPORAL: deshabilitado para pruebas — solo Certificado Digital activo
    {
      id: 'claveMobile' as AuthMethod,
      icon: Smartphone,
      title: 'Cl@ve Móvil',
      description: 'Autentícate usando la aplicación Cl@ve en tu smartphone',
      recommended: false,
    },
    {
      id: 'doctorId' as AuthMethod,
      icon: Shield,
      title: 'DoctorID',
      description: 'Accede con tu credencial verificable DoctorID desde tu cartera digital',
      recommended: false,
    },
    */
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src="/cgcom-header-logo.svg" alt="CGCOM - Organización Médica Colegial" className="h-12 w-auto" />
              <div className="border-l border-gray-300 pl-6">
                <p className="text-sm font-medium text-gray-700">Cartera de Identidad Digital</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {step === 'select' && (
          <div>
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-[#1A5276] rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Autenticación Segura
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Selecciona tu método preferido de autenticación. Todos los métodos son igualmente seguros.
              </p>
            </div>

            <div className="grid gap-6 mb-8">
              {authMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <Card
                    key={method.id}
                    className="p-6 cursor-pointer hover:shadow-lg transition-all hover:border-[#E67E22] relative"
                    onClick={() => handleSelectMethod(method.id)}
                  >
                    {method.recommended && (
                      <div className="absolute top-4 right-4">
                        <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                          Recomendado
                        </span>
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-[#1A5276]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-7 h-7 text-[#1A5276]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-2">{method.title}</h3>
                        <p className="text-gray-600 mb-4">{method.description}</p>
                        <div className="flex items-center gap-2 text-[#E67E22]">
                          <span className="font-semibold">Seleccionar este método</span>
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* TEMPORAL: oculto mientras solo está activo el método de Certificado Digital
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">
                    ¿Qué es Cl@ve?
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Cl@ve es el sistema de identificación electrónica del Gobierno de España.
                    Permite a los ciudadanos acceder de forma segura a los servicios públicos digitales
                    utilizando diferentes métodos de autenticación.
                  </p>
                </div>
              </div>
            </Card>
            */}
          </div>
        )}

        {step === 'authenticate' && selectedMethod && (
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('select');
                setCertData(null);
                setCertError(null);
                setCertLoading(false);
              }}
              className="mb-6 text-gray-600"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Cambiar método
            </Button>

            <Card className="p-8 max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-[#1A5276]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  {selectedMethod === 'eDNI' && <CreditCard className="w-10 h-10 text-[#1A5276]" />}
                  {selectedMethod === 'certificate' && <Shield className="w-10 h-10 text-[#1A5276]" />}
                  {selectedMethod === 'claveMobile' && <Smartphone className="w-10 h-10 text-[#1A5276]" />}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedMethod === 'eDNI' && 'Autenticación con DNI Electrónico'}
                  {selectedMethod === 'certificate' && 'Autenticación con Certificado Digital'}
                  {selectedMethod === 'claveMobile' && 'Autenticación con Cl@ve Móvil'}
                </h3>
                <p className="text-gray-600">
                  {selectedMethod === 'eDNI' && 'Introduce tu DNI y conecta tu lector de tarjetas'}
                  {selectedMethod === 'certificate' && 'Selecciona tu certificado digital (ej: FNMT) instalado en este dispositivo'}
                  {selectedMethod === 'claveMobile' && 'Escanea el código QR con la app Cl@ve'}
                </p>
              </div>

              {/* ─── eDNI Method ─── */}
              {selectedMethod === 'eDNI' && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="dni">Número de DNI</Label>
                    <Input
                      id="dni"
                      placeholder="12345678A"
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pin">PIN del DNI electrónico</Label>
                    <Input
                      id="pin"
                      type="password"
                      placeholder="****"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="mt-2"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Es el PIN de 4 dígitos que estableciste al obtener tu DNI electrónico
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <strong>Nota de demostración:</strong> Este es un entorno de prueba.
                      En producción, la autenticación se realizará mediante el sistema oficial Cl@ve.
                    </p>
                  </div>
                </div>
              )}

              {/* ─── Certificate Method ─── */}
              {selectedMethod === 'certificate' && (
                <div className="space-y-6">
                  {/* No certificate data yet — show loading or error state */}
                  {!certData && (
                    <>
                      {/* Estado: cargando (popup abierto, esperando selección del certificado) */}
                      {certLoading && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                          <Loader2 className="w-12 h-12 text-[#1A5276] mx-auto mb-4 animate-spin" />
                          <p className="text-gray-700 font-semibold mb-2">
                            Esperando selección de certificado...
                          </p>
                          <p className="text-gray-600 text-sm">
                            Selecciona tu certificado en la ventana que se ha abierto en tu navegador.
                          </p>
                        </div>
                      )}

                      {/* Estado: error con botón de reintento (RF-002) */}
                      {certError && !certLoading && (
                        <>
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-red-800">Error</p>
                              <p className="text-sm text-red-700">{certError}</p>
                            </div>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <Shield className="w-12 h-12 text-[#1A5276] mx-auto mb-4" />
                            <Button
                              onClick={handleCertificateSelect}
                              disabled={certLoading}
                              className="bg-[#1A5276] hover:bg-[#154060] text-white"
                            >
                              <ExternalLink className="mr-2 w-5 h-5" />
                              Reintentar
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Bloque de requisitos — siempre visible mientras !certData */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-blue-800 mb-1">Requisitos</p>
                            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                              <li>Tener un certificado digital instalado en el navegador (ej: FNMT)</li>
                              <li>Permitir ventanas emergentes para este sitio</li>
                              <li>El servidor de certificados debe estar ejecutándose (<code className="bg-blue-100 px-1 rounded">npm run cert-server</code>)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Certificate data received — show extracted attributes */}
                  {certData && (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-green-800">Certificado leído correctamente</p>
                          <p className="text-sm text-green-700">
                            Certificado {certData.certificateType === 'personal' ? 'personal' : 'de organización'} válido
                          </p>
                        </div>
                      </div>

                      {/* Subject attributes */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <User className="w-5 h-5 text-[#1A5276]" />
                          Datos del titular
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4">
                          {certData.subject.commonName && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre completo</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.commonName}</p>
                            </div>
                          )}
                          {certData.subject.givenName && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.givenName}</p>
                            </div>
                          )}
                          {certData.subject.surname && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Apellidos</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.surname}</p>
                            </div>
                          )}
                          {certData.subject.serialNumber && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <Fingerprint className="w-3.5 h-3.5" /> DNI / NIF
                              </p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.serialNumber}</p>
                            </div>
                          )}
                          {certData.subject.emailAddress && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.emailAddress}</p>
                            </div>
                          )}
                          {certData.subject.organization && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <Building className="w-3.5 h-3.5" /> Organización
                              </p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.organization}</p>
                            </div>
                          )}
                          {certData.subject.organizationalUnit && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidad organizativa</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.organizationalUnit}</p>
                            </div>
                          )}
                          {certData.subject.organizationIdentifier && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NIF Organización</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.organizationIdentifier}</p>
                            </div>
                          )}
                          {certData.subject.country && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">País</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.country}</p>
                            </div>
                          )}
                          {certData.subject.locality && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Localidad</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.locality}</p>
                            </div>
                          )}
                          {certData.subject.province && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Provincia</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.subject.province}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Issuer info */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Shield className="w-5 h-5 text-[#1A5276]" />
                          Emisor del certificado
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4">
                          {certData.issuer.commonName && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.issuer.commonName}</p>
                            </div>
                          )}
                          {certData.issuer.organization && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Organización</p>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{certData.issuer.organization}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Validity */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-[#1A5276] flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-700">
                            <strong>Validez:</strong> {formatDate(certData.validFrom)} — {formatDate(certData.validTo)}
                          </p>
                        </div>
                      </div>

                      {/* Option to re-select */}
                      <div className="text-center">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setCertData(null);
                            setCertError(null);
                          }}
                          className="text-sm text-gray-500"
                        >
                          Seleccionar otro certificado
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── Cl@ve Movil Method ─── */}
              {selectedMethod === 'claveMobile' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <div className="w-48 h-48 bg-white border-4 border-gray-900 rounded-lg mx-auto mb-4 flex items-center justify-center">
                      <div className="grid grid-cols-3 gap-1 p-4">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="w-4 h-4 bg-gray-900 rounded-sm" />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-600 mb-2">
                      Escanea este código QR con tu app Cl@ve Móvil
                    </p>
                    <p className="text-sm text-gray-500">
                      Código: 4829-3847-2938-4756
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <strong>Nota de demostración:</strong> Este es un entorno de prueba.
                      En producción, se generará un código QR real para autenticación.
                    </p>
                  </div>
                </div>
              )}

              {/* ─── Action buttons ─── */}
              <div className="mt-8 flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('select');
                    setCertData(null);
                    setCertError(null);
                    setCertLoading(false);
                  }}
                  className="flex-1"
                  disabled={isAuthenticating}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAuthenticate}
                  className="flex-1 bg-[#E67E22] hover:bg-[#D35400] text-white"
                  disabled={
                    isAuthenticating ||
                    (selectedMethod === 'certificate' && !certData)
                  }
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Autenticar
                      <ChevronRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                ¿Problemas con la autenticación?{' '}
                <a href="#" className="text-[#E67E22] font-semibold hover:underline">
                  Ver guía de ayuda
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
