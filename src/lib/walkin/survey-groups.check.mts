import assert from "node:assert/strict";
// @ts-expect-error Node runs this check directly.
import { SURVEY_GROUPS, SURVEY_QUESTIONS } from "./survey-questions.ts";

for (const brand of Object.keys(SURVEY_QUESTIONS) as (keyof typeof SURVEY_QUESTIONS)[]) {
  const grouped: string[] = SURVEY_GROUPS[brand].flatMap(group => group.keys);
  const expected: string[] = SURVEY_QUESTIONS[brand].map(question => question.key).filter(key => key !== "sales_staff");
  assert.equal(new Set(grouped).size, grouped.length, `${brand}: a question is in two groups`);
  assert.deepEqual([...grouped].sort(), [...expected].sort(), `${brand}: groups must cover every question except sales_staff, with no unknown key`);
}
