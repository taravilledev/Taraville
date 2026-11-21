import { displayLabel, type SurveyQuestion } from "@/lib/walkin/survey-questions";
import { walkinFieldClass, walkinOptionClass, walkinOtherFieldClass } from "./walkin-form-styles";

export function SurveyField({ question, answers = {} }: { question: SurveyQuestion; answers?: Record<string, string | string[]> }) {
  const id = `survey-${question.key}`;
  const answer = answers[question.key];
  const label = displayLabel(question);

  if (question.legacy) {
    return typeof answer === "string" && answer ? (
      <label data-slot="walkin-field" className={walkinFieldClass} htmlFor={id}>
        {label}
        <input id={id} name={`survey.${question.key}`} value={answer} readOnly />
      </label>
    ) : null;
  }

  if (!("options" in question)) {
    return (
      <label data-slot="walkin-field" className={walkinFieldClass} htmlFor={id}>
        {label}
        <input id={id} name={`survey.${question.key}`} type={question.kind} defaultValue={typeof answer === "string" ? answer : ""} maxLength={4000}
          inputMode={question.kind === "number" ? "decimal" : undefined}
          min={question.kind === "number" ? 0 : undefined}
          placeholder={question.placeholder} autoComplete="off" />
      </label>
    );
  }

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0 [&>legend]:mb-3 [&>legend]:w-full [&>legend]:text-sm [&>legend]:font-semibold [&:not(:has(input[value='อื่นๆ']:checked))_[data-slot=survey-other]]:hidden">
      <legend>{label}</legend>
      <div className="grid grid-cols-2 gap-2 min-[1180px]:grid-cols-3 max-[640px]:grid-cols-1">
        {question.options.filter(option => !question.legacyOptions?.includes(option)
          || (Array.isArray(answer) ? answer.includes(option) : answer === option)).map((option, index) => (
          <label className={walkinOptionClass} key={option}>
            <input id={`${id}-${index}`} type={question.kind === "multi" ? "checkbox" : "radio"}
              name={`survey.${question.key}`} value={option} defaultChecked={Array.isArray(answer) ? answer.includes(option) : answer === option} />
            <span>{option}{question.legacyOptions?.includes(option) ? " (ข้อมูลเดิม)" : ""}</span>
          </label>
        ))}
      </div>
      {question.options.includes("อื่นๆ") && (
        <label data-slot="survey-other" className={walkinOtherFieldClass} htmlFor={`${id}-other`}>
          หากเลือกอื่นๆ โปรดระบุ
          <input id={`${id}-other`} name={`survey.${question.key}_other`} defaultValue={typeof answers[`${question.key}_other`] === "string" ? answers[`${question.key}_other`] : ""} maxLength={4000} placeholder="รายละเอียดเพิ่มเติม" />
        </label>
      )}
    </fieldset>
  );
}
