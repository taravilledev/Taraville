import type { Metadata } from "next";
import { House, ArrowUpRight } from "lucide-react";
import { palettes } from "../palette-options";
import { previewFonts } from "../preview-fonts";
import form from "../walkin.module.css";
import styles from "./styles.module.css";

export const metadata: Metadata = { title: "เลือกสีและฟอนต์ · Taraville Walk-in", robots: { index: false, follow: false } };

export default function StyleOptionsPage() {
  return (
    <main className={`${styles.page} ${previewFonts}`} lang="th">
      <header className={styles.heading}>
        <a href="/walkin">กลับไปแบบปัจจุบัน</a>
        <p className={styles.eyebrow}>TARAVILLE GROUP · WALK-IN</p>
        <h1>ให้การเริ่มต้นคุยเรื่องบ้าน<br />ดูเป็นมิตรขึ้นอีกนิด</h1>
        <p>แบบหลักใช้พีชอุ่น คู่กับ Nunito + Sarabun ตามที่เลือกแล้ว<br />ยังเปิดดูชุดอื่นเพื่อเปรียบเทียบได้</p>
      </header>

      <section aria-labelledby="palette-title">
        <div className={styles.sectionTitle}><h2 id="palette-title">เลือกบรรยากาศของสี</h2><span>ทั้ง 3 ชุดใช้ Nunito Sans + Anuphan เพื่อเทียบสีได้ตรงกัน</span></div>
        <div className={styles.paletteGrid}>
          {palettes.map(palette => (
            <article key={palette.id} className={`${form.shell} ${styles.paletteCard}`} data-font="friendly" style={{ ...palette.colors, minHeight: 0 }}>
              <div className={styles.cardHeading}><h3>{palette.name}</h3><p>{palette.description}</p></div>
              <div className={styles.swatches} aria-label={`ชุดสี ${palette.name}`}>
                {[palette.colors["--accent"], palette.colors["--tint"], palette.colors["--canvas"], palette.colors["--ink"]].map(color => <div key={color}><span style={{ backgroundColor: color }} /><code>{color}</code></div>)}
              </div>
              <div className={styles.sample}>
                <div className={styles.brand}><House size={24} aria-hidden="true" /><strong>บ้านคุณภาพ <small>BAAN KUNAPAP</small></strong></div>
                <h4>ยินดีที่ได้รู้จัก</h4><p>มาคุยเรื่องบ้านที่คุณต้องการกัน</p>
                <label className={form.field}>ชื่อของลูกค้า<input readOnly placeholder="เช่น พิมพ์ใจ" /></label>
                <fieldset className={form.question}><legend>บ้านแบบไหนที่กำลังมองหา?</legend><div className={styles.sampleOptions}>
                  <label className={form.option}><input type="radio" name={`house-${palette.id}`} defaultChecked /><span>บ้านชั้นเดียว</span></label>
                  <label className={form.option}><input type="radio" name={`house-${palette.id}`} /><span>บ้านสองชั้น</span></label>
                </div></fieldset>
                <span className={styles.sampleButton}>บันทึกข้อมูลลูกค้า</span>
              </div>
              <a className={styles.previewLink} href={`/walkin?palette=${palette.id}&font=friendly`}>ลองกับฟอร์มเต็ม <ArrowUpRight size={17} aria-hidden="true" /></a>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="font-title" className={styles.fontSection}>
        <div className={styles.sectionTitle}><h2 id="font-title">เลือกน้ำเสียงของตัวอักษร</h2><span>จับคู่กับสีไหนก็ได้</span></div>
        <div className={styles.fontGrid}>
          <article className={`${form.shell} ${styles.fontCard}`} data-font="friendly" style={{ minHeight: 0 }}>
            <p className={styles.fontLabel}>1 · ร่วมสมัย</p><h3>Nunito Sans + Anuphan</h3>
            <h4>บ้านที่ใช่ เริ่มจากความเข้าใจ</h4><p>ยินดีต้อนรับ วันนี้กำลังมองหาบ้านแบบไหน?<br /><span lang="en">A little closer to your dream home.</span></p>
            <p className={styles.fontDescription}>ไทยไม่มีหัว เส้นนุ่ม ดูร่วมสมัย คู่กับอังกฤษที่เป็นมิตร</p>
            <div className={styles.fontLinks}>{palettes.map(p => <a key={p.id} href={`/walkin?palette=${p.id}&font=friendly`}>ลอง {p.name}</a>)}</div>
          </article>
          <article className={`${form.shell} ${styles.fontCard}`} data-font="humanist" style={{ minHeight: 0 }}>
            <p className={styles.fontLabel}>2 · แบบที่เลือก</p><h3>Nunito + Sarabun</h3>
            <h4>บ้านที่ใช่ เริ่มจากความเข้าใจ</h4><p>ยินดีต้อนรับ วันนี้กำลังมองหาบ้านแบบไหน?<br /><span lang="en">A little closer to your dream home.</span></p>
            <p className={styles.fontDescription}>ไทยมีหัว อ่านคุ้นตา คู่กับอังกฤษปลายมน ให้ความรู้สึกผ่อนคลาย</p>
            <div className={styles.fontLinks}>{palettes.map(p => <a key={p.id} href={`/walkin?palette=${p.id}&font=humanist`}>ลอง {p.name}</a>)}</div>
          </article>
        </div>
      </section>
      <p className={styles.recommendation}>แบบที่เลือก: <strong>C · พีชอุ่น + Nunito / Sarabun</strong></p>
    </main>
  );
}
