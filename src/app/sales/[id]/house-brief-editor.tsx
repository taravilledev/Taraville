"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "../sales.module.css";

export function HouseBriefEditor({ label, summary, children }: {
  label: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isEditing) content.current?.querySelector("input")?.focus();
  }, [isEditing]);

  return <>
    <div className={styles.houseBriefHeader}>
      <h2 id="house-brief">ความต้องการบ้าน</h2>
      <button ref={toggle} type="button" className={styles.link} aria-expanded={isEditing}
        aria-controls="house-brief-content" onClick={() => {
          if (content.current?.querySelector("fieldset:disabled")) return;
          if (isEditing) toggle.current?.focus();
          setIsEditing(!isEditing);
        }}>
        {isEditing ? "ยกเลิก" : label}
      </button>
    </div>
    <div id="house-brief-content" ref={content}>{isEditing ? children : summary}</div>
  </>;
}
