import { privacyNotice } from "@/lib/walkin/privacy";
import type { Brand } from "@/lib/walkin/survey-questions";
import styles from "./walkin.module.css";

export function VersionedNotice({ brand, mode = "real" }: { brand: Brand; mode?: "synthetic" | "real" }) {
  const notice = privacyNotice(mode);
  return <div className={styles.noticeArticle}>
    <p className={styles.eyebrow}>ฉบับ {notice.version} · {mode === "synthetic" ? "ข้อมูลสมมติเท่านั้น" : "ประกาศสำหรับผู้สนใจ"}</p>
    <p><strong>{notice.companies[brand]}</strong><br />{notice.address}</p>
    <p>ติดต่อ: <a href={`mailto:${notice.contact}`}>{notice.contact}</a></p>
    {notice.sections.map(section => <section key={section.heading}>
      <h3>{section.heading}</h3><p>{section.text}</p>
    </section>)}
  </div>;
}
