/**
 * Contrato de la frontera Identificación → Emisión.
 *
 * Estos tipos definen el handoff entre el Portal de Identificación con certificado
 * FNMT (este repo) y el Portal de Emisión (`eudistack-cgcom-mfe-issuance-portal`).
 *
 * ⚠️ DUPLICADO INTENCIONAL: la misma definición vive en
 * `eudistack-cgcom-mfe-issuance-portal/src/types.ts`. Al separar la demo monolítica
 * (`demo-cgcom/src/portal.tsx`) en dos SPAs, el tipo compartido se duplica a ambos
 * lados de la frontera. Mantener en sync hasta que exista un paquete de contrato
 * o se formalice vía SDD (Épicas EUDISTACK-621 / EUDISTACK-622).
 */

export interface CertificateSubject {
  commonName?: string;
  givenName?: string;
  surname?: string;
  serialNumber?: string; // DNI en certificados españoles
  organization?: string;
  organizationalUnit?: string;
  organizationIdentifier?: string;
  country?: string;
  locality?: string;
  province?: string;
  streetAddress?: string;
  postalCode?: string;
  emailAddress?: string;
  [key: string]: string | undefined;
}

export interface CertificateData {
  subject: CertificateSubject;
  issuer: CertificateSubject;
  validFrom: string;
  validTo: string;
  certificateType: 'personal' | 'organizational';
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  collegiateNumber: string;
  dni: string;
  email: string;
  phone: string;
  college: string;
  specialty: string;
  authMethod: 'eDNI' | 'certificate' | 'claveMobile';
  certificateData?: CertificateData;
}
