export async function POST() {
  return Response.json({ error: "制作実績用デモでは決済通知を受け付けません" }, { status: 403 });
}
