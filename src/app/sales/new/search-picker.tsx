"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "../sales.module.css";

type Option = { id: string; label: string; detail?: string; search?: string };

export function SearchPicker({ label, placeholder, options, selectedId, onChange, required = false }: {
  label: string; placeholder: string; options: Option[]; selectedId: string; onChange: (id: string) => void; required?: boolean;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasLeftField, setHasLeftField] = useState(false);
  const selected = options.find(item => item.id === selectedId);
  const matches = selected ? options : options.filter(item => `${item.label} ${item.detail ?? ""} ${item.search ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    list.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);
  useEffect(() => {
    input.current?.setCustomValidity(query && !selectedId ? `เลือก${label}จากรายการ หรือเคลียร์คำค้น` : "");
  }, [query, selectedId, label]);
  const error = hasLeftField && query && !selectedId ? `เลือก${label}จากรายการ หรือกดล้างคำค้น` : "";
  function select(id: string) {
    input.current?.focus();
    onChange(id); setQuery(""); setIsOpen(false); setActiveIndex(-1);
  }
  return <div className={`${styles.field} ${styles.unitPicker}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setIsOpen(false); setHasLeftField(true); }
  }}>
    <label htmlFor={`${listId}-input`}>{label}</label>
    <div className={styles.unitInput}>
      <input ref={input} id={`${listId}-input`} role="combobox" aria-expanded={isOpen} aria-controls={listId} aria-autocomplete="list"
        aria-describedby={error ? `${listId}-error` : undefined} aria-invalid={error ? true : undefined}
        aria-activedescendant={isOpen && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off" placeholder={placeholder} required={required} value={selected?.label ?? query}
        onInvalid={() => setHasLeftField(true)} onFocus={() => setIsOpen(true)} onChange={event => {
          setQuery(event.target.value); onChange(""); setIsOpen(true); setActiveIndex(-1);
        }} onKeyDown={event => {
          if (event.key === "Escape") { setIsOpen(false); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setIsOpen(true);
            setActiveIndex(index => event.key === "ArrowDown" ? Math.min(index + 1, matches.length - 1) : Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && isOpen && matches[activeIndex]) {
            event.preventDefault(); select(matches[activeIndex].id);
          }
        }} />
      {(selectedId || query) && <button type="button" className={styles.pickerButton} aria-label={`ล้าง${label}`} onClick={() => select("")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>}
      <button type="button" className={styles.pickerButton} aria-label={`แสดงรายการ${label}`} aria-expanded={isOpen} aria-controls={listId}
        onClick={() => { const shouldOpen = !isOpen; input.current?.focus(); setIsOpen(shouldOpen); setActiveIndex(-1); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    </div>
    {error && <small id={`${listId}-error`} role="alert">{error}</small>}
    {isOpen && <ul ref={list} id={listId} role="listbox" aria-label={`รายการ${label}`} className={styles.unitOptions}>
      {matches.map((item, index) => <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={item.id === selectedId} data-active={index === activeIndex}>
        <button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => select(item.id)}><strong>{item.label}</strong>{item.detail && <span>{item.detail}</span>}</button>
      </li>)}
      {!matches.length && <li className={styles.muted}>ไม่พบ{label}ที่ตรงกับคำค้น</li>}
    </ul>}
  </div>;
}
