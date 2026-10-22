import type { SurveyQuestion } from "@/lib/walkin/survey-questions";
import styles from "./walkin.module.css";

export function SurveyField({ question, answers = {} }: { question: SurveyQuestion; answers?: Record<string, string | string[]> }) {
  const id = `survey-${question.key}`;
  const answer = answers[question.key];

  if (!("options" in question)) {
    return (
      <label className={styles.field} htmlFor={id}>
        {question.label}
        <input id={id} name={`survey.${question.key}`} type={question.kind} defaultValue={typeof answer === "string" ? answer : ""} maxLength={4000}
          inputMode={question.kind === "number" ? "decimal" : undefined}
          min={question.kind === "number" ? 0 : undefined}
          placeholder={question.placeholder} autoComplete="off" />
      </label>
    );
  }

  return (
    <fieldset className={styles.question}>
      <legend>{question.label}</legend>
      <div className={styles.options}>
        {question.options.map((option, index) => (
          <label className={styles.option} key={option}>
            <input id={`${id}-${index}`} type={question.kind === "multi" ? "checkbox" : "radio"}
              name={`survey.${question.key}`} value={option} defaultChecked={Array.isArray(answer) ? answer.includes(option) : answer === option} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {question.options.includes("อื่นๆ") && (
        <label className={styles.otherField} htmlFor={`${id}-other`}>
          หากเลือกอื่นๆ โปรดระบุ
          <input id={`${id}-other`} name={`survey.${question.key}_other`} defaultValue={typeof answers[`${question.key}_other`] === "string" ? answers[`${question.key}_other`] : ""} maxLength={4000} placeholder="รายละเอียดเพิ่มเติม" />
        </label>
      )}
    </fieldset>
  );
}
