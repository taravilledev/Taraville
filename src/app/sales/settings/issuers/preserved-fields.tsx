import type { Issuer } from "./issuer-data";

/**
 * saveIssuer reads a missing field as false/empty, so every form posting to it must resend what it does not edit.
 * Test mode is only switched off by a separately approved go-live task (ADR 0062), never by a settings form.
 */
export function PreservedFlags({ issuer, keepApproval }: { issuer?: Issuer; keepApproval: boolean }) {
  return <>
    {/* A brand with no issuer row yet starts with test mode off (ADR 0062 §4, matching the new column default). */}
    {issuer?.is_synthetic === true && <input type="hidden" name="is_synthetic" value="on" />}
    {keepApproval && issuer?.contract_text_approved && <input type="hidden" name="contract_text_approved" value="on" />}
  </>;
}
