/**
 * The parts of /admin that can be handed to someone who is not an admin.
 *
 * ADMIN_EMAILS are the full admins: every section, always, and nobody can take
 * that away from the app. Anyone else holds only the sections stored in their
 * `users.admin_sections` — e.g. Thực đơn + Đơn hàng for the colleague who posts
 * the menu, without the bank account or the payments. Only a full admin may
 * change who holds what, so a section can never be used to grant more.
 */
export const ADMIN_SECTIONS = ["menu", "bookings", "payments", "bills", "emails", "settings"] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export const ADMIN_SECTION_INFO: Record<
  AdminSection,
  { label: string; href: string; description: string }
> = {
  menu: {
    label: "Thực đơn",
    href: "/admin/menu",
    description: "Soạn, mở và khoá thực đơn; xem thực đơn nháp.",
  },
  bookings: {
    label: "Đơn hàng",
    href: "/admin/bookings",
    description: "Xem đơn từng ngày, xuất file, đặt món hộ người khác.",
  },
  payments: {
    label: "Bảng thu",
    href: "/admin/payments",
    description: "Xác nhận chuyển khoản, đánh dấu đã trả.",
  },
  bills: {
    label: "Hoá đơn riêng",
    href: "/admin/bills",
    description: "Viết và xoá hoá đơn tay cho từng người.",
  },
  emails: {
    label: "Email",
    href: "/admin/emails",
    description: "Soạn, hẹn giờ và gửi email cho mọi người.",
  },
  settings: {
    label: "Cài đặt",
    href: "/admin/settings",
    description: "Tài khoản nhận tiền, giao diện, lì xì, giảm giá, tên và ngày sinh thành viên.",
  },
};

/** Drops anything the code no longer knows, so a stale value grants nothing. */
export function parseAdminSections(raw: readonly string[] | null | undefined): AdminSection[] {
  if (!raw) return [];
  return ADMIN_SECTIONS.filter((section) => raw.includes(section));
}
