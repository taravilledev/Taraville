import type { Issuer } from "./issuer-data";

/**
 * saveIssuer reads a missing field as false/empty, so every form posting to it must resend what it does not edit.
 * Test mode is not one of them: the database keeps it and no form can change it (ADR 0066).
 */
export function PreservedFlags({ issuer, keepApproval }: { issuer?: Issuer; keepApproval: boolean }) {
  return <>
    {keepApproval && issuer?.contract_text_approved && <input type="hidden" name="contract_text_approved" value="on" />}
  </>;
}
