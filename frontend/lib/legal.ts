export interface LegalInfo {
  provider: string;      // e.g. address-service "c/o" line
  name: string;
  street: string;
  city: string;          // "PLZ Ort"
  country: string;
  email: string;
  represented: string;   // Vertretungsberechtigte(r)
}

// Filled with the booked Impressum-address service before go-live.
export const legal: LegalInfo = {
  provider: "",
  name: "",
  street: "",
  city: "",
  country: "Deutschland",
  email: "",
  represented: "",
};
