import { NextRequest, NextResponse } from "next/server";
import { getInsights, EntityType, DOMAIN_LABELS } from "@/lib/qloo";

export async function POST(req: NextRequest) {
  const { entityIds, outputTypes } = await req.json() as {
    entityIds: string[];
    outputTypes: EntityType[];
  };

  if (!entityIds?.length || !outputTypes?.length) {
    return NextResponse.json({ error: "entityIds and outputTypes required" }, { status: 400 });
  }

  const results = await Promise.all(
    outputTypes.map(async (type) => ({
      domain: DOMAIN_LABELS[type],
      type,
      entities: await getInsights(entityIds, type),
    }))
  );

  return NextResponse.json(results.filter((r) => r.entities.length > 0));
}
