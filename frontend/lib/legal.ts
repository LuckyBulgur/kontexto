export interface LegalInfo {
  /** First postal line: display name (pseudonym) followed by the real name. */
  name: string;
  /** "c/o" line of the booked Impressum-address service — required for correct mail delivery. */
  careOf: string;
  /** Street and house number. */
  street: string;
  /** Postal code and city ("PLZ Ort"). */
  city: string;
  country: string;
  email: string;
  /**
   * Second electronic contact path as required by § 5 Abs. 1 Nr. 2 DDG, in addition
   * to {@link LegalInfo.email}: a contact form (provided by the address service) that
   * forwards messages by e-mail.
   */
  contactFormUrl: string;
  /** Competent regulatory and supervisory authority (Medienstaatsvertrag). */
  supervisoryAuthority: string;
}

export const legal: LegalInfo = {
  name: "kontexto - Ugur Aydogan",
  careOf: "c/o Online-Impressum #8822",
  street: "Europaring 90",
  city: "53757 Sankt Augustin",
  country: "Deutschland",
  email: "info@kontexto.de",
  contactFormUrl: "https://mein.online-impressum.de/kontexto/#Zweiter_Kontaktweg",
  supervisoryAuthority: "Niedersächsische Landesmedienanstalt, Deutschland",
};
