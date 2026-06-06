const BUILD_API_BASE =
  process.env.KONTEXTO_BUILD_API_BASE || "http://127.0.0.1:8000/api";

export async function getRatingAggregate(): Promise<{
  ratingValue: number;
  ratingCount: number;
}> {
  try {
    const res = await fetch(`${BUILD_API_BASE}/rating`);
    if (!res.ok) return { ratingValue: 0, ratingCount: 0 };
    return await res.json();
  } catch {
    return { ratingValue: 0, ratingCount: 0 };
  }
}
