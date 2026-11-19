// True when the form has typed values worth warning about before the page is left.
export function formHasDraft(formId: string): boolean {
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) return false;
  const data = new FormData(form);
  // The hidden owner value is assigned automatically for sales staff.
  if (!form.querySelector('select[name="owner_id"]')) data.delete("owner_id");
  return Array.from(data).some(([key, value]) =>
    !key.startsWith("$ACTION_") && typeof value === "string" && value.trim() !== "");
}
