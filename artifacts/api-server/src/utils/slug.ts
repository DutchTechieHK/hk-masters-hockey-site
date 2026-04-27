export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export async function generateUniqueSlug(
  title: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = generateSlug(title) || "article";
  let slug = base;
  let counter = 2;
  while (await exists(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}
