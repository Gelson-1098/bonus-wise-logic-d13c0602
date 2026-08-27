// MOTOR DE CÁLCULO DO BÔNUS — puro, sem valores fixos de negócio.
// Todos os parâmetros (valor base, pesos, valores, gatilho) vêm da versão da regra.

export type EngineCriterion = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  weight_pct: number | null;
  value_brl: number | null;
  is_eliminatory: boolean;
  eliminatory_action: string | null;
  target_text: string | null;
  active: boolean;
};

export type CriterionStatus = "atingiu" | "nao_atingiu" | "nao_aplicavel";

export type EngineResult = {
  criterion_id: string;
  status: CriterionStatus;
  result_value?: number | null;
};

export type EngineParams = {
  baseValue: number | null;
  minTriggerPct: number;
  alertPct: number;
  targetPct: number;
  target: number | null;
  revenue: number | null;
  criteria: EngineCriterion[];
  results: EngineResult[];
  noBonus: boolean;
  noBonusReason?: string | null;
  versionName?: string | null;
};

export type EngineLine = {
  criterion_id: string;
  name: string;
  category: string | null;
  weight_pct: number | null;
  value_brl: number;
  status: CriterionStatus;
  awarded: number;
  is_eliminatory: boolean;
  target_text: string | null;
};

export type EngineStatus =
  | "pendente"
  | "sem_gatilho"
  | "eliminado"
  | "sem_bonus"
  | "aprovado";

export type EngineOutput = {
  status: EngineStatus;
  statusLabel: string;
  attainment: number | null;
  eligibility: "nao_elegivel" | "alerta" | "elegivel" | "superada" | "indefinido";
  gross: number;
  total: number;
  cappedAt: number | null;
  lines: EngineLine[];
  reasons: string[];
  alerts: string[];
  filled: boolean;
  computedAt: string;
};

const STATUS_LABEL: Record<EngineStatus, string> = {
  pendente: "PENDENTE",
  sem_gatilho: "SEM GATILHO",
  eliminado: "ELIMINADO",
  sem_bonus: "SEM BÔNUS",
  aprovado: "CALCULADO",
};

export function calculateBonus(params: EngineParams): EngineOutput {
  const alerts: string[] = [];
  const reasons: string[] = [];
  const criteria = params.criteria.filter((c) => c.active);
  const byId = new Map(params.results.map((r) => [r.criterion_id, r]));

  const scoring = criteria.filter((c) => !c.is_eliminatory);
  const eliminatory = criteria.filter((c) => c.is_eliminatory);

  const lines: EngineLine[] = criteria.map((c) => {
    const status = byId.get(c.id)?.status ?? "nao_aplicavel";
    const value = Number(c.value_brl ?? 0);
    return {
      criterion_id: c.id,
      name: c.name,
      category: c.category,
      weight_pct: c.weight_pct,
      value_brl: value,
      status,
      awarded: !c.is_eliminatory && status === "atingiu" ? value : 0,
      is_eliminatory: c.is_eliminatory,
      target_text: c.target_text,
    };
  });

  const attainment =
    params.target && params.target > 0 && params.revenue !== null && params.revenue !== undefined
      ? (Number(params.revenue) / Number(params.target)) * 100
      : null;

  const eligibility: EngineOutput["eligibility"] =
    attainment === null
      ? "indefinido"
      : attainment >= params.targetPct
        ? "superada"
        : attainment >= params.alertPct
          ? "elegivel"
          : attainment >= params.minTriggerPct
            ? "alerta"
            : "nao_elegivel";

  // Alertas de informação crítica faltando — nunca calcular silenciosamente.
  if (params.baseValue === null || params.baseValue === undefined)
    alerts.push("Cargo sem valor base configurado.");
  if (params.target === null || params.target === undefined || Number(params.target) === 0)
    alerts.push("Meta de faturamento não cadastrada para a loja/período.");
  if (params.revenue === null || params.revenue === undefined)
    alerts.push("Faturamento realizado não informado.");
  if (criteria.length === 0) alerts.push("Nenhum critério configurado para este cargo.");

  const weightSum = scoring.reduce((s, c) => s + Number(c.weight_pct ?? 0), 0);
  if (scoring.length > 0 && Math.abs(weightSum - 100) > 0.5)
    alerts.push(`Os pesos configurados para este cargo totalizam ${weightSum.toFixed(2)}%.`);

  const valueSum = scoring.reduce((s, c) => s + Number(c.value_brl ?? 0), 0);
  if (params.baseValue && Math.abs(valueSum - Number(params.baseValue)) > 0.01)
    alerts.push(
      `A soma dos valores dos critérios (R$ ${valueSum.toFixed(2)}) difere do valor base do cargo (R$ ${Number(params.baseValue).toFixed(2)}).`,
    );

  const unfilledScoring = scoring.filter(
    (c) => !byId.has(c.id) || byId.get(c.id)!.status === "nao_aplicavel",
  );
  const unfilledElim = eliminatory.filter((c) => !byId.has(c.id));
  const filled = unfilledScoring.length === 0 && unfilledElim.length === 0;
  if (!filled) alerts.push(`${unfilledScoring.length + unfilledElim.length} indicador(es) sem lançamento.`);

  const gross = lines.reduce((s, l) => s + l.awarded, 0);
  const base = params.baseValue === null || params.baseValue === undefined ? null : Number(params.baseValue);
  const cappedAt = base !== null && gross > base ? base : null;
  const capped = cappedAt !== null ? cappedAt : gross;

  const occurredEliminatory = lines.filter((l) => l.is_eliminatory && l.status === "nao_atingiu");

  let status: EngineStatus = "aprovado";
  let total = capped;

  if (params.noBonus) {
    status = "sem_bonus";
    total = 0;
    reasons.push(
      params.noBonusReason?.trim()
        ? `Marcado como "não receberá bônus": ${params.noBonusReason.trim()}`
        : 'Marcado como "não receberá bônus" sem justificativa informada.',
    );
    if (!params.noBonusReason?.trim()) alerts.push("Justificativa obrigatória não informada.");
  } else if (attainment === null) {
    status = "pendente";
    total = 0;
    reasons.push("Meta ou faturamento realizado não informados — cálculo não realizado.");
  } else if (attainment < params.minTriggerPct) {
    status = "sem_gatilho";
    total = 0;
    reasons.push(
      `Atingimento de ${attainment.toFixed(2)}% ficou abaixo do gatilho mínimo de ${params.minTriggerPct}% do faturamento.`,
    );
  } else if (occurredEliminatory.length > 0) {
    status = "eliminado";
    total = 0;
    reasons.push(
      `Critério eliminatório identificado: ${occurredEliminatory.map((l) => l.name).join(", ")}.`,
    );
  } else if (!filled) {
    status = "pendente";
    total = 0;
    reasons.push("Existem indicadores sem lançamento — cálculo não concluído.");
  } else {
    reasons.push(
      `Gatilho atingido (${attainment.toFixed(2)}% ≥ ${params.minTriggerPct}%), nenhum critério eliminatório.`,
    );
    const notAchieved = lines.filter((l) => !l.is_eliminatory && l.status !== "atingiu");
    if (notAchieved.length > 0)
      reasons.push(
        `Não recebeu o valor integral porque não atingiu: ${notAchieved.map((l) => l.name).join(", ")}.`,
      );
    if (cappedAt !== null)
      reasons.push(`Valor limitado ao teto do cargo (R$ ${cappedAt.toFixed(2)}).`);
  }

  return {
    status,
    statusLabel: STATUS_LABEL[status],
    attainment,
    eligibility,
    gross,
    total,
    cappedAt,
    lines,
    reasons,
    alerts,
    filled,
    computedAt: new Date().toISOString(),
  };
}

export const ELIGIBILITY_LABEL: Record<EngineOutput["eligibility"], string> = {
  nao_elegivel: "Não elegível",
  alerta: "Em alerta",
  elegivel: "Elegível",
  superada: "Meta superada",
  indefinido: "Sem meta/realizado",
};

export type StoreEligibility = {
  isEligible: boolean;
  status: "ELEGÍVEL" | "INELEGÍVEL" | "INDEFINIDO";
  attainment: number | null;
  minTriggerPct: number;
  message: string;
};

export function checkStoreEligibility(
  revenueActual: number | null | undefined,
  metaRevenue: number | null | undefined,
  minTriggerPct: number = 90,
): StoreEligibility {
  if (
    metaRevenue === null ||
    metaRevenue === undefined ||
    Number(metaRevenue) <= 0 ||
    revenueActual === null ||
    revenueActual === undefined
  ) {
    return {
      isEligible: false,
      status: "INDEFINIDO",
      attainment: null,
      minTriggerPct,
      message: "Meta ou faturamento realizado não informados.",
    };
  }

  const attainment = (Number(revenueActual) / Number(metaRevenue)) * 100;
  const isEligible = attainment >= minTriggerPct;

  return {
    isEligible,
    status: isEligible ? "ELEGÍVEL" : "INELEGÍVEL",
    attainment,
    minTriggerPct,
    message: isEligible
      ? `A loja atingiu ${attainment.toFixed(2)}% da meta (gatilho mínimo: ${minTriggerPct}%) e está ELEGÍVEL ao bônus integral.`
      : `A loja atingiu ${attainment.toFixed(2)}% da meta, ficando abaixo do gatilho mínimo de ${minTriggerPct}%. A loja está INELEGÍVEL ao bônus.`,
  };
}

