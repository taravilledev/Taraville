type Template = { contract_text_approved?: boolean; contractor_name?: string; is_synthetic?: boolean };

/** The first company-level prerequisite (set by an executive) still missing before a BKP contract can be drafted and locked. */
export function missingContractPrerequisite(template: Template | undefined) {
  if (!template) return null;
  if (!template.contractor_name) return "issuer_configuration_required";
  return template.is_synthetic || template.contract_text_approved ? null : "approved_contract_text_required";
}
