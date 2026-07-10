/**
 * Contrato de frontera: Identificación (cert-identifier) → Emisión (issuance-portal).
 *
 * Puerto directo desde src/types.ts del repo React.
 * Mantener en sync con eudistack-cgcom-mfe-issuance-portal hasta que exista
 * un paquete de contrato compartido (EUDISTACK-621 / EUDISTACK-622).
 */

export interface CertificateSubject {
  commonName?: string;
  givenName?: string;
  surname?: string;
  /** DNI en certificados españoles */
  serialNumber?: string;
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

/** Auth method identifiers — superset of AuthenticatedUser.authMethod (includes 'doctorId'). */
export type AuthMethod = 'eDNI' | 'certificate' | 'claveMobile' | 'doctorId';
