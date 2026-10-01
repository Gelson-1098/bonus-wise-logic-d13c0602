export type BenefitEntry = {
  id: string;
  employeeId?: string | undefined;
  positionId?: string | undefined;
  positionName?: string | undefined;
  storeName: string;
  collaborator: string;
  year: number;
  month: number;
  diasMes: number;
  folgas: number;
  diasDevidos: number;
  valorVr: number;
  totalVr: number;
  vtDiarista: number;
  vtMensalista: number;
  depositoDiario: number;
  totalVt: number;
  aditivoVt: number;
  aditivoVr: number;
  transportMode?: "onibus_mensal" | "combo_mensal" | "onibus_diario" | "personalizado" | undefined;
  occurrences?: BenefitOccurrence[] | undefined;
  adjustments?: BenefitAdjustment[] | undefined;
  zeroed?: boolean | undefined;
  zeroedReason?: string | undefined;
  zeroedAt?: string | undefined;
  zeroedBy?: string | undefined;
  originalCalculation?: BenefitCalculationSnapshot | undefined;
  obs: string;
  totalBeneficios: number;
};

export type BenefitOccurrence = {
  id: string;
  type: "FALTA" | "ATESTADO" | "BH" | "OUTRO";
  days: number;
  note: string;
  deductFromDueDays: boolean;
  createdBy?: string | undefined;
  createdAt?: string | undefined;
};

export type BenefitAdjustment = {
  id: string;
  kind: "ADITIVO" | "DESCONTO";
  category: "VR" | "VT";
  value: number;
  description: string;
};

export type BenefitCalculationSnapshot = {
  diasDevidos: number;
  totalVr: number;
  depositoDiario: number;
  totalVt: number;
  totalBeneficios: number;
};

export type BenefitParameter = {
  id: string;
  region: "SP" | "GRU" | "ES" | "GERAL";
  storeName?: string;
  benefitType: "VR" | "VT";
  description: string;
  valueType: "diario" | "mensal" | "tabela";
  defaultValue: number;
  ruleName: string;
  transportSystem?: string;
  active: boolean;
};

export const DEFAULT_BENEFIT_PARAMETERS: BenefitParameter[] = [
  // VR
  { id: "vr-sp", region: "SP", benefitType: "VR", description: "Vale Refeição São Paulo (Padrão)", valueType: "diario", defaultValue: 39.13, ruleName: "VALOR VR - SP", active: true },
  { id: "vr-gru", region: "GRU", benefitType: "VR", description: "Vale Refeição Guarulhos / Aeroporto", valueType: "diario", defaultValue: 42.96, ruleName: "VALOR VR - GRU", active: true },
  { id: "vr-spol", region: "SP", storeName: "Spoleto Jabaquara", benefitType: "VR", description: "Vale Refeição Spoleto", valueType: "diario", defaultValue: 25.00, ruleName: "VALOR VR - SPOLETO", active: true },
  { id: "vr-es", region: "ES", benefitType: "VR", description: "Vale Refeição Espírito Santo", valueType: "diario", defaultValue: 25.00, ruleName: "VALOR VR - ES", active: true },

  // VT - SPTRANS (São Paulo)
  { id: "vt-sp-combo", region: "SP", benefitType: "VT", description: "Ônibus + Metrô Ferroviário SPTrans", valueType: "mensal", defaultValue: 411.13, ruleName: "ONIBUS + SISTEMA METRÔ FERROVIÁRIO", transportSystem: "SPTRANS", active: true },
  { id: "vt-sp-onibus", region: "SP", benefitType: "VT", description: "Ônibus SPTrans", valueType: "mensal", defaultValue: 257.53, ruleName: "ÔNIBUS", transportSystem: "SPTRANS", active: true },
  { id: "vt-sp-metro", region: "SP", benefitType: "VT", description: "Sistema Metrô Ferroviário SP", valueType: "mensal", defaultValue: 262.43, ruleName: "SISTEMA METRÔ FERROVIÁRIO", transportSystem: "SPTRANS", active: true },
  { id: "vt-sp-diario", region: "SP", benefitType: "VT", description: "Integração Ônibus + Metrô Diarista", valueType: "diario", defaultValue: 10.28, ruleName: "INTEGRAÇÃO ÔNIBUS + METRÔ", transportSystem: "SPTRANS", active: true },
  { id: "vt-onibus-diario", region: "GERAL", benefitType: "VT", description: "Ônibus diário", valueType: "diario", defaultValue: 10.60, ruleName: "ÔNIBUS DIÁRIO", active: true },

  // VT - GUARULHOS (EMTU)
  { id: "vt-gru-mensal", region: "GRU", benefitType: "VT", description: "Mensal Aeroporto GRU", valueType: "mensal", defaultValue: 315.00, ruleName: "MENSAL GRU", transportSystem: "EMTU", active: true },
  { id: "vt-gru-diario", region: "GRU", benefitType: "VT", description: "Diário GRU EMTU", valueType: "diario", defaultValue: 16.00, ruleName: "DIÁRIO ( PLANILHA )", transportSystem: "EMTU", active: true },

  // VT - ESPÍRITO SANTO
  { id: "vt-es-serra", region: "ES", storeName: "Serra", benefitType: "VT", description: "Diário Serra EMTU/Transcol", valueType: "diario", defaultValue: 12.60, ruleName: "DIÁRIO ( PLANILHA )", transportSystem: "TRANSCOL", active: true },
  { id: "vt-es-camburi", region: "ES", storeName: "Jardim Camburi", benefitType: "VT", description: "Diário Camburi Transcol", valueType: "diario", defaultValue: 10.60, ruleName: "DIÁRIO ( PLANILHA )", transportSystem: "TRANSCOL", active: true },
  { id: "vt-es-canto", region: "ES", storeName: "Praia do Canto", benefitType: "VT", description: "Mensal Praia do Canto", valueType: "mensal", defaultValue: 257.53, ruleName: "ÔNIBUS", transportSystem: "TRANSCOL", active: true },
];
