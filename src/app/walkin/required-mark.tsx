import styles from "./walkin.module.css";

// Decorative: the input's own `required` attribute is what assistive tech announces.
export function RequiredMark() {
  return <span className={styles.required} aria-hidden="true"> *</span>;
}
