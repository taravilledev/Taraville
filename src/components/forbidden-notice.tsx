import { primaryActionClass } from "@/components/action-link-styles"
import { Panel } from "@/components/panel"

// "ยังไม่มีสิทธิ์ทำงานนี้": tells the person what the work needs and who can grant it (design-system §8 Access).
export function ForbiddenNotice({ need, ask, backHref, backLabel }: { need: string; ask: string; backHref: string; backLabel: string }) {
  return (
    <Panel className="mx-auto mt-10 flex max-w-lg flex-col items-start gap-3.5 p-8">
      <span className="grid size-13 place-items-center rounded-lg bg-muted text-primary" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <h1 className="m-0 text-title font-bold">ยังไม่มีสิทธิ์ทำงานนี้</h1>
      <p className="m-0 leading-relaxed text-muted-foreground">{need} · {ask}</p>
      <a className={`${primaryActionClass} mt-1`} href={backHref}>{backLabel}</a>
    </Panel>
  )
}
