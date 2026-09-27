import { DinoRace } from "@/components/race/dino-race";
import { getDayBookingsByPerson } from "@/db/queries/bookings";
import { getMenuDaysForDate } from "@/db/queries/menu";
import { getAllMembers } from "@/db/queries/users";
import { pageTitle } from "@/lib/app-name";
import { requireUser } from "@/lib/auth/session";
import { isBirthdayOn, toBirthday } from "@/lib/birthday";
import { todayServiceDate } from "@/lib/date";
import { fallbackDisplayName } from "@/lib/display-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Đua vui") };

export default async function RacePage() {
  await requireUser();

  const today = todayServiceDate();
  const [menus, people] = await Promise.all([getMenuDaysForDate(today), getAllMembers()]);
  const members = people.map((person) => ({
    name: person.displayName ?? fallbackDisplayName(person.email),
    birthday: isBirthdayOn(toBirthday(person.birthMonth, person.birthDay), today),
  }));
  // Everyone who ordered today, from either sitting, once each.
  const lines = (
    await Promise.all(
      menus.filter((menu) => menu.status !== "draft").map((menu) => getDayBookingsByPerson(menu.id)),
    )
  ).flat();
  const todayDiners = [
    ...new Map(
      lines.map((line) => [line.userId, line.displayName ?? fallbackDisplayName(line.email)]),
    ).values(),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Đua vui 🏁</h1>
        <p className="text-muted-foreground text-sm">
          Tự lập danh sách, chọn đua bằng gì và bao lâu, rồi cùng xem ai về nhất — ai đi lấy cơm,
          ai được bao nước.
        </p>
      </div>

      <DinoRace
        todayDiners={todayDiners}
        members={members.map((member) => member.name)}
        birthdays={members.filter((member) => member.birthday).map((member) => member.name)}
      />
    </div>
  );
}
