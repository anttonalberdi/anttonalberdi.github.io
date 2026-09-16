const DEFAULT_LIMIT = 3;

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Select the newest homepage publications from the Airtable export.
 *
 * The exporter supplies `year` and `order`; order is the tie-breaker for
 * publications from the same year. `featured: false` is Airtable's explicit
 * "Hide from homepage" flag.
 */
export function selectLatestPublications(publications, limit = DEFAULT_LIMIT) {
  if (!Array.isArray(publications)) return [];

  const parsedLimit = Number.parseInt(String(limit), 10);
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;

  return publications
    .filter((publication) => publication?.featured !== false)
    .slice()
    .sort((a, b) => {
      const yearDifference = numericValue(b?.year) - numericValue(a?.year);
      if (yearDifference) return yearDifference;

      const orderDifference = numericValue(b?.order) - numericValue(a?.order);
      if (orderDifference) return orderDifference;

      return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
    })
    .slice(0, safeLimit);
}
