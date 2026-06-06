export type LeadNextStepType = "call" | "proposal" | "discard";

export const LEAD_NEXT_STEP_OPTIONS: {
  value: LeadNextStepType;
  label: string;
  description: string;
}[] = [
  {
    value: "call",
    label: "Llamada agendada",
    description: "Siguiente paso: conversación con el lead",
  },
  {
    value: "proposal",
    label: "Propuesta enviada",
    description: "Enviaste presupuesto o alcance por escrito",
  },
  {
    value: "discard",
    label: "Descartar",
    description: "No encaja o no responde; archivar el seguimiento",
  },
];

export const NEXT_STEP_LABELS: Record<LeadNextStepType, string> = {
  call: "Llamada",
  proposal: "Propuesta",
  discard: "Descartado",
};

export function statusRequiresNextStep(status: string): boolean {
  return ["contacted", "replied", "interested", "negotiation"].includes(status);
}
