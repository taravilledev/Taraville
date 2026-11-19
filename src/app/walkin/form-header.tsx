import type { ReactNode } from "react";
import Image from "next/image";
import { COMPANIES } from "@/lib/walkin/companies";
import type { Brand } from "@/lib/walkin/survey-questions";
import { walkinTitleClass } from "./walkin-form-styles";

export function FormHeader({ brand, title, note, action }: { brand: Brand; title: string; note?: ReactNode; action?: ReactNode }) {
  const company = COMPANIES[brand];
  return <div className="mb-6 flex items-center gap-4 max-[640px]:flex-col max-[640px]:items-start">
    <span className="relative aspect-[2/1] w-28 shrink-0 overflow-hidden rounded-sm border bg-card [&_img]:object-cover"><Image src={company.logo} alt={company.name} fill sizes="112px" priority style={{ objectPosition: company.logoFocus }} /></span>
    <div className="min-w-0 flex-1"><h1 className={walkinTitleClass}>{title} · {company.brandName}</h1>{note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}</div>
    {action}
  </div>;
}
