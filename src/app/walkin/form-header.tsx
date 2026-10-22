import type { ReactNode } from "react";
import Image from "next/image";
import { COMPANIES } from "@/lib/walkin/companies";
import type { Brand } from "@/lib/walkin/survey-questions";
import styles from "./walkin.module.css";

export function FormHeader({ brand, title, note, action }: { brand: Brand; title: string; note?: ReactNode; action?: ReactNode }) {
  const company = COMPANIES[brand];
  return <div className={styles.formHeader}>
    <span className={styles.formHeaderLogo}><Image src={company.logo} alt={company.name} fill sizes="112px" priority style={{ objectPosition: company.logoFocus }} /></span>
    <div className={styles.formHeaderText}><h1 className={styles.pageTitle}>{title} · {company.brandName}</h1>{note && <p className={styles.hint}>{note}</p>}</div>
    {action}
  </div>;
}
