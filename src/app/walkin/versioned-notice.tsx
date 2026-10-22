import { PRIVACY_NOTICE } from "@/lib/walkin/privacy";
import type { Brand } from "@/lib/walkin/survey-questions";
import styles from "./walkin.module.css";

export function VersionedNotice({ brand }: { brand: Brand }) {
  return <div className={styles.noticeArticle}>
    <p className={styles.eyebrow}>ฉบับ {PRIVACY_NOTICE.version} · ข้อมูลสมมติเท่านั้น</p>
    <p><strong>{PRIVACY_NOTICE.companies[brand]}</strong><br />{PRIVACY_NOTICE.address}</p>
    <p>ติดต่อ: <a href={`mailto:${PRIVACY_NOTICE.contact}`}>{PRIVACY_NOTICE.contact}</a></p>
    {PRIVACY_NOTICE.sections.map(section => <section key={section.heading}>
      <h3>{section.heading}</h3><p>{section.text}</p>
    </section>)}
  </div>;
}
