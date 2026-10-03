/**
 * Nike footwear conversions from the official U.S. women's and men's charts.
 * The published CM/JP column is a shoe-label size, not foot length. Foot length
 * values below come from Nike's Foot Length (in) row and are converted to cm.
 * Sources: nike.com/size-fit/womens-footwear and nike.com/size-fit/mens-footwear.
 */
export type NikeFootwearSizeSystem = "women" | "men";

export function inferNikeFootwearSizeSystem(input: {sourceUrl?: string; currency?: string; category?: string; title?: string}): NikeFootwearSizeSystem | undefined {
  if (input.currency !== 'USD' || input.category !== 'Обувь') return;
  try {
    const source = new URL(input.sourceUrl ?? '');
    if (source.protocol !== 'https:' || !['nike.com','www.nike.com'].includes(source.hostname)) return;
  } catch { return; }
  if (/\bwomen['’]s\b/i.test(input.title ?? '')) return 'women';
  if (/\bmen['’]s\b/i.test(input.title ?? '')) return 'men';
}

export type NikeFootwearSizeRow = {
  us: string;
  uk: string;
  eu: string;
  cmLabel: string;
  footLengthCm?: number;
};

type NikeChartColumns = {
  end: number;
  uk: string;
  eu: string;
  cmLabel: string;
  footLengthInches: readonly number[];
};

const WOMEN: NikeChartColumns = {
  end: 22.5,
  uk: "1.5|1.5|2|2.5|3|3.5|4|4.5|5|5.5|6|6.5|7|7.5|8|8.5|9|9.5|10|10.5|11|11.5|12|12.5|13|13.5|14|14.5|15|15.5|16|16.5|17|17.5|18|18.5|19|19.5|20",
  eu: "33.5|34.5|35|35.5|36|36.5|37.5|38|38.5|39|40|40.5|41|42|42.5|43|44|44.5|45|45.5|46|47|47.5|48|48.5|49|50|50.5|51|51.5|52|52.5|53|53.5|54|54.5|55|55.5|56",
  cmLabel: "21|21|21.5|22|22.5|23|23.5|24|24.5|25|25.5|26|26.5|27|27.5|28|28.5|29|29.5|30|30.5|31|31.5|32|32.5|33|33.5|34|34.5|35|35.5|36|36.5|37|37.5|38|38.5|39|39.5",
  footLengthInches: [
    8 + 3 / 16, 8 + 5 / 16, 8.5, 8 + 11 / 16, 8 + 13 / 16, 9,
    9 + 3 / 16, 9 + 5 / 16, 9.5, 9 + 11 / 16, 9 + 13 / 16, 10,
    10 + 3 / 16, 10 + 5 / 16, 10.5, 10 + 11 / 16, 10 + 13 / 16, 11,
    11 + 3 / 16, 11 + 5 / 16, 11.5, 11 + 11 / 16, 11 + 13 / 16, 12,
    12 + 3 / 16, 12 + 5 / 16, 12.5, 12 + 11 / 16,
  ],
};

const MEN: NikeChartColumns = {
  end: 22,
  uk: "3|3.5|4|4.5|5|5.5|6|6|6.5|7|7.5|8|8.5|9|9.5|10|10.5|11|11.5|12|12.5|13|13.5|14|14.5|15|15.5|16|16.5|17|17.5|18|18.5|19|19.5|20|20.5|21",
  eu: "35.5|36|36.5|37.5|38|38.5|39|40|40.5|41|42|42.5|43|44|44.5|45|45.5|46|47|47.5|48|48.5|49|49.5|50|50.5|51|51.5|52|52.5|53|53.5|54|54.5|55|55.5|56|56.5",
  cmLabel: "22.5|23|23.5|23.5|24|24|24.5|25|25.5|26|26.5|27|27.5|28|28.5|29|29.5|30|30.5|31|31.5|32|32.5|33|33.5|34|34.5|35|35.5|36|36.5|37|37.5|38|38.5|39|39.5|40",
  footLengthInches: [
    8.5, 8 + 11 / 16, 8 + 13 / 16, 9, 9 + 3 / 16, 9 + 5 / 16,
    9.5, 9 + 11 / 16, 9 + 13 / 16, 10, 10 + 3 / 16, 10 + 5 / 16,
    10.5, 10 + 11 / 16, 10 + 13 / 16, 11, 11 + 3 / 16, 11 + 5 / 16,
    11.5, 11 + 11 / 16, 11 + 13 / 16, 12, 12 + 3 / 16, 12 + 5 / 16,
    12.5, 12 + 11 / 16, 12 + 13 / 16, 13, 13 + 3 / 16, 13 + 5 / 16,
    13.5, 13 + 11 / 16, 13 + 13 / 16, 14, 14 + 3 / 16, 14 + 5 / 16,
    14.5, 14 + 11 / 16,
  ],
};

function halfSizes(end: number) {
  return Array.from({ length: Math.round((end - 3.5) * 2) + 1 }, (_, index) =>
    String(3.5 + index / 2),
  );
}

function rows(chart: NikeChartColumns): NikeFootwearSizeRow[] {
  const us = halfSizes(chart.end);
  const uk = chart.uk.split("|");
  const eu = chart.eu.split("|");
  const cmLabel = chart.cmLabel.split("|");
  if ([uk.length, eu.length, cmLabel.length].some((length) => length !== us.length)) {
    throw new Error("Nike size chart columns must have matching lengths.");
  }
  return us.map((size, index) => {
    const inches = chart.footLengthInches[index];
    return {
      us: size,
      uk: uk[index],
      eu: eu[index],
      cmLabel: cmLabel[index],
      ...(inches === undefined ? {} : { footLengthCm: Math.round(inches * 2.54 * 10) / 10 }),
    };
  });
}

const CHARTS: Record<NikeFootwearSizeSystem, NikeFootwearSizeRow[]> = {
  women: rows(WOMEN),
  men: rows(MEN),
};

function normalizeSize(size: string) {
  const value = size.trim().replace(/^US\s*/i, "");
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : value.toLocaleLowerCase();
}

export function getNikeFootwearSizeRows(
  system: NikeFootwearSizeSystem,
  availableUsSizes?: readonly string[],
) {
  const chart = CHARTS[system];
  if (!availableUsSizes) return chart;
  const available = new Set(availableUsSizes.map(normalizeSize));
  return chart.filter((row) => available.has(normalizeSize(row.us)));
}

export function findNikeFootwearSizeRow(system: NikeFootwearSizeSystem, size: string) {
  const normalized = normalizeSize(size);
  return CHARTS[system].find((row) => normalizeSize(row.us) === normalized);
}
