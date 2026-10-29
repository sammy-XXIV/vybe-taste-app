const BASE = process.env.QLOO_BASE_URL!;
const KEY = process.env.QLOO_API_KEY!;

const ENTITY_TYPES = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:place",
  "urn:entity:destination",
  "urn:entity:brand",
  "urn:entity:book",
  "urn:entity:video_game",
  "urn:entity:podcast",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const DOMAIN_LABELS: Record<EntityType, string> = {
  "urn:entity:artist": "Music",
  "urn:entity:movie": "Movies",
  "urn:entity:tv_show": "TV Shows",
  "urn:entity:place": "Restaurants & Places",
  "urn:entity:destination": "Travel",
  "urn:entity:brand": "Brands",
  "urn:entity:book": "Books",
  "urn:entity:video_game": "Video Games",
  "urn:entity:podcast": "Podcasts",
};

export interface QlooEntity {
  entity_id: string;
  name: string;
  type: string;
  popularity?: number;
  properties?: {
    description?: string;
    image?: string;
    image_url?: string;
  };
}

const headers = { "X-Api-Key": KEY };

export async function searchEntity(query: string, type?: string): Promise<QlooEntity[]> {
  const params = new URLSearchParams({ query, limit: "5" });
  if (type) params.set("types", type.replace("urn:entity:", ""));
  const res = await fetch(`${BASE}/search?${params}`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  // normalize: search returns `types[]`, insights returns `type` string
  const items: QlooEntity[] = data.results ?? data.entities ?? [];
  return items.map((e) => ({
    ...e,
    type: e.type ?? (Array.isArray((e as any).types) ? (e as any).types[0] : undefined),
  }));
}

export async function getInsights(
  signalEntityIds: string[],
  outputType: EntityType,
  limit = 8
): Promise<QlooEntity[]> {
  const params = new URLSearchParams({
    "filter.type": outputType,
    limit: String(limit),
  });
  signalEntityIds.forEach((id) => params.append("signal.interests.entities", id));

  const res = await fetch(`${BASE}/v2/insights?${params}`, { headers });
  if (!res.ok) {
    console.error("Qloo insights error", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return data.results?.entities ?? data.entities ?? [];
}
