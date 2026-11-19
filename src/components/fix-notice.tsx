import Link from "next/link";
import { Notice } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import type { Fix } from "@/lib/errors/error-map";

/** A prerequisite message with the link to where it is fixed; the link is absent when this user cannot fix it. */
export function FixNotice({ message, fix }: { message: string; fix?: Fix }) {
  return <Notice role="status" className="grid justify-items-start gap-3">
    <p className="m-0">{message}</p>
    {fix && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={fix.href} prefetch={false}>{fix.label}</Link>}
  </Notice>;
}
