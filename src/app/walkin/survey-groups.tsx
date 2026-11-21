import { SURVEY_GROUPS, SURVEY_QUESTIONS, type Brand } from "@/lib/walkin/survey-questions";
import { SurveyField } from "./survey-field";

// preferred_location only shows while "ทำเลที่ตั้ง" is ticked among the decision factors.
const showPreferredLocationWhenTicked = String.raw`[&:not(:has(input[name='survey.decision\_factors'][value='ทำเลที่ตั้ง']:checked))_label[for=survey-preferred\_location]]:hidden`;

export function SurveyGroups({ brand, answers }: { brand: Brand; answers?: Record<string, string | string[]> }) {
  const questions = new Map(SURVEY_QUESTIONS[brand].map(question => [question.key, question]));
  return <div className={`flex flex-col gap-8 ${showPreferredLocationWhenTicked}`}>
    {SURVEY_GROUPS[brand].map(group => {
      const shown = group.keys.flatMap(key => { const question = questions.get(key); return question && (!question.legacy || answers?.[key]) ? [question] : []; });
      return shown.length ? <div key={group.label} className="flex flex-col gap-6">
        <h3 className="m-0 border-b pb-2 text-sm font-bold">{group.label}</h3>
        {shown.map(question => <SurveyField key={question.key} question={question} answers={answers} />)}
      </div> : null;
    })}
  </div>;
}
