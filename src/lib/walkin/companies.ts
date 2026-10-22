import type { Brand } from "./survey-questions";

export const COMPANIES: Record<Brand, { brandName: string; name: string; logo: string }> = {
  BAAN_KUNAPAP: {
    brandName: "บ้านคุณภาพ", name: "บริษัท บ้านคุณภาพ เพชรบูรณ์ จำกัด", logo: "/brand/baan-kunapap-logo.jpg",
  },
  TARAVILLE: {
    brandName: "Taraville", name: "บริษัท ธารทอง พรอพเพอร์ตี้ แอนด์ คอนสตรัคชั่น จำกัด", logo: "/brand/tarnthong-symbol.jpg",
  },
};
export const COMPANY_ADDRESS = "555/24 หมู่ 2 ตำบลสะเดียง อำเภอเมืองเพชรบูรณ์ จังหวัดเพชรบูรณ์";
export const PRIVACY_CONTACT = "taraville.dev@gmail.com";
