import type { Brand } from "./survey-questions";

// logoFocus crops the owner-supplied JPEG margins with CSS object-position; the files stay untouched.
export const COMPANIES: Record<Brand, { brandName: string; name: string; logo: string; logoFocus: string }> = {
  BAAN_KUNAPAP: {
    brandName: "บ้านคุณภาพ", name: "บริษัท บ้านคุณภาพ เพชรบูรณ์ จำกัด", logo: "/brand/baan-kunapap-logo.jpg", logoFocus: "50% 20%",
  },
  TARAVILLE: {
    brandName: "Taraville", name: "บริษัท ธารทอง พรอพเพอร์ตี้ แอนด์ คอนสตรัคชั่น จำกัด", // ponytail: the company symbol stands in for the Taraville wordmark, which was not supplied separately — swap path and focus when it arrives
    logo: "/brand/tarnthong-symbol.jpg", logoFocus: "50% 10%",
  },
};
export const COMPANY_ADDRESS = "555/24 หมู่ 2 ตำบลสะเดียง อำเภอเมืองเพชรบูรณ์ จังหวัดเพชรบูรณ์";
export const PRIVACY_CONTACT = "taraville.dev@gmail.com";
