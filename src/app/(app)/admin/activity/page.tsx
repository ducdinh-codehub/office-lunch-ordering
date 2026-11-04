import { TZDate } from "@date-fns/tz";
import { format, formatDistanceStrict } from "date-fns";
import { vi } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMemberActivity, type MemberActivity } from "@/db/queries/users";
import { requireAdmin } from "@/lib/auth/session";
import { APP_TIMEZONE, formatInstant, shiftServiceDate, todayServiceDate } from "@/lib/date";
import { pageTitle } from "@/lib/app-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Hoạt động") };

/**
 * `last_seen_at` is written at most every 5 minutes (`touchLastSeen()`), so
 * anyone seen within twice that is still on the app.
 */
const ONLINE_WINDOW_MS = 10 * 60 * 1000;

type Group = { title: string; members: MemberActivity[] };

/** The Vietnam calendar date an instant falls on. */
function serviceDateOf(instant: Date) {
  return format(new TZDate(instant, APP_TIMEZONE), "yyyy-MM-dd");
}

/**
 * Who has signed in and when they last used the app. Full admins only — this
 * is not a section and cannot be handed to anyone.
 */
export default async function AdminActivityPage() {
  await requireAdmin();
  const members = await getMemberActivity();

  const now = new Date();
  const today = todayServiceDate();
  const weekAgo = shiftServiceDate(today, -7);

  const groups: Group[] = [
    { title: "Đang dùng app", members: [] },
    { title: "Hôm nay", members: [] },
    { title: "7 ngày qua", members: [] },
    { title: "Lâu hơn", members: [] },
    { title: "Chưa thấy hoạt động", members: [] },
  ];
  for (const member of members) {
    const seen = member.lastSeenAt;
    if (!seen) groups[4].members.push(member);
    else if (now.getTime() - seen.getTime() <= ONLINE_WINDOW_MS) groups[0].members.push(member);
    else if (serviceDateOf(seen) === today) groups[1].members.push(member);
    else if (serviceDateOf(seen) > weekAgo) groups[2].members.push(member);
    else groups[3].members.push(member);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hoạt động</h1>
        <p className="text-muted-foreground text-sm">
          Ai đã đăng nhập và lần cuối dùng app lúc nào. Thời gian cập nhật mỗi khoảng 5 phút; chỉ
          quản lý chính xem được trang này.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Đang dùng" value={groups[0].members.length} />
        <Stat label="Hôm nay" value={groups[0].members.length + groups[1].members.length} />
        <Stat label="Thành viên" value={members.length} />
      </div>

      {groups
        .filter((group) => group.members.length > 0)
        .map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-base">
                {group.title}{" "}
                <span className="text-muted-foreground font-normal">({group.members.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.members.map((member) => (
                <MemberActivityRow
                  key={member.id}
                  member={member}
                  now={now}
                  online={group === groups[0]}
                />
              ))}
            </CardContent>
          </Card>
        ))}

      {members.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Chưa có ai đăng nhập vào app.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background rounded-lg border p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

function MemberActivityRow({
  member,
  now,
  online,
}: {
  member: MemberActivity;
  now: Date;
  online: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2.5">
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.photoUrl}
          alt=""
          className="size-8 shrink-0 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
        >
          {member.name.slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{member.name}</div>
        <div className="text-muted-foreground truncate text-xs">{member.email}</div>
      </div>

      <div className="shrink-0 text-right text-xs">
        {member.lastSeenAt ? (
          online ? (
            <Badge className="bg-emerald-600 text-white">Đang dùng</Badge>
          ) : (
            <div title={formatInstant(member.lastSeenAt)}>
              {formatDistanceStrict(member.lastSeenAt, now, { locale: vi, addSuffix: true })}
            </div>
          )
        ) : (
          <div className="text-muted-foreground">—</div>
        )}
        <div className="text-muted-foreground mt-0.5">
          Lần đầu {formatInstant(member.createdAt)}
        </div>
      </div>
    </div>
  );
}
