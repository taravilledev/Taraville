export type NavIcon = "home" | "overview" | "walkin" | "leads" | "projects" | "finance" | "report" | "settings"
export type NavItem = { href: string; label: string; icon: NavIcon }

const EXECUTIVE: NavItem[] = [
  { href: "/dashboard", label: "ภาพรวม", icon: "overview" },
  { href: "/walkin", label: "รับลูกค้า", icon: "walkin" },
  { href: "/leads", label: "ลูกค้า (Lead)", icon: "leads" },
  { href: "/sales", label: "โครงการ", icon: "projects" },
  { href: "/summary", label: "การเงินบ้านคุณภาพ", icon: "finance" },
  { href: "/leads/report", label: "รายงาน Lead", icon: "report" },
  { href: "/sales/settings", label: "ตั้งค่า", icon: "settings" },
]

const FIELD: NavItem[] = [
  { href: "/dashboard", label: "หน้าหลัก", icon: "home" },
  { href: "/walkin", label: "รับลูกค้า", icon: "walkin" },
  { href: "/leads", label: "ลูกค้า (Lead)", icon: "leads" },
  { href: "/sales", label: "โครงการ", icon: "projects" },
  { href: "/leads/report", label: "รายงาน Lead", icon: "report" },
]

const SALE: NavItem[] = [...FIELD, { href: "/sales/settings", label: "ตั้งค่า", icon: "settings" }]

// ตั้งค่า shows for executives and sales (catalog editors and read-only viewers, flow-to-be §3.9); the settings page
// itself decides which tabs a sale may open, so the sidebar needs no extra query.
export function navItems(role: "sale" | "executive" | "staff"): NavItem[] {
  return role === "executive" ? EXECUTIVE : role === "sale" ? SALE : FIELD
}

// Longest href that equals the path or is a parent segment of it.
export function activeHref(pathname: string, items: NavItem[]): string | undefined {
  return items
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}
