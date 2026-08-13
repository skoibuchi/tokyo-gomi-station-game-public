import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { totalPoints: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      totalPoints: true,
      _count: { select: { reports: true } },
    },
  });

  const ranking = users.map((u) => ({
    id: u.id,
    name: u.name,
    totalPoints: u.totalPoints,
    reportCount: u._count.reports,
  }));

  return NextResponse.json(ranking);
}
