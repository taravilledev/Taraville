import type { CSSProperties } from "react";

type PaletteColors = CSSProperties & {
  "--ink": string;
  "--muted": string;
  "--accent": string;
  "--tint": string;
  "--line": string;
  "--canvas": string;
};

type PaletteOption = { id: string; name: string; description: string; colors: PaletteColors };

export const palettes: PaletteOption[] = [
  { id: "blue", name: "A · ฟ้าหม่น", description: "โปร่ง สบายตา เป็นมิตรและยังดูมืออาชีพ", colors: {
    "--ink": "#243858", "--muted": "#536680", "--accent": "#3564A0",
    "--tint": "#EAF2FD", "--line": "#D3DFED", "--canvas": "#F4F7FC",
  } },
  { id: "lavender", name: "B · ลาเวนเดอร์", description: "นุ่มนวล ร่วมสมัย และมีบุคลิกต่างจากระบบงานทั่วไป", colors: {
    "--ink": "#3C304F", "--muted": "#6C607B", "--accent": "#7755A3",
    "--tint": "#F1EBF8", "--line": "#E2D9ED", "--canvas": "#F8F5FC",
  } },
  { id: "peach", name: "C · พีชอุ่น", description: "อบอุ่น ชวนคุย เหมาะกับการรับลูกค้าเรื่องบ้าน", colors: {
    "--ink": "#4D352E", "--muted": "#7B655C", "--accent": "#A44F36",
    "--tint": "#FBEDE5", "--line": "#EADBD1", "--canvas": "#FCF7F3",
  } },
];
