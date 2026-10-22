import Image from "next/image";
import { COMPANIES, COMPANY_ADDRESS, PRIVACY_CONTACT } from "@/lib/walkin/companies";
import type { Brand } from "@/lib/walkin/survey-questions";
import styles from "./walkin.module.css";

export function CompanyNotice({ brand }: { brand: Brand }) {
  const company = COMPANIES[brand];
  return <section className={styles.card} aria-labelledby="company-title">
    <div className={styles.companyIdentity}>
      <Image src={company.logo} alt={`โลโก้ ${company.name}`} width={108} height={72} className={styles.companyLogo} />
      <div><p className={styles.eyebrow}>บริษัทผู้รับผิดชอบ · {company.brandName}</p>
        <h2 id="company-title">{company.name}</h2><p>{COMPANY_ADDRESS}</p></div>
    </div>
    <p className={styles.privacyText}>ข้อมูลติดต่อและคำตอบใช้เพื่อรับเรื่อง ประเมินความต้องการ และติดต่อกลับเรื่องบ้านหรือบริการที่สอบถาม ไม่รวมการส่งโปรโมชั่น</p>
    <p className={styles.privacyText}>ขณะนี้เป็นแบบทดสอบ ใช้ข้อมูลสมมติเท่านั้น ข้อความความเป็นส่วนตัวอยู่ระหว่างจัดทำ</p>
    <a className={styles.noticeLink} href={`/privacy?brand=${brand}`} target="_blank" rel="noopener noreferrer">อ่านร่างประกาศความเป็นส่วนตัว (เปิดแท็บใหม่)</a>
    <p className={styles.companyContact}>ติดต่อเรื่องข้อมูลส่วนบุคคล: <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a></p>
  </section>;
}
