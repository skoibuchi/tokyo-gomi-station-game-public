import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ユーザー登録 or 取得（簡易版：email基準）
export async function POST(request: NextRequest) {
  const { name, email } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: "name, emailは必須です" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { name, email },
  });

  return NextResponse.json(user);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "emailは必須です" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      pointLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { reports: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  return NextResponse.json(user);
}
