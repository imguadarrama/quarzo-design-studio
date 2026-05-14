const COMBINING_DIACRITICS = /[̀-ͯ]/g;
const NON_ALNUM = /[^a-z0-9]+/g;
const TRIM_DASHES = /^-+|-+$/g;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(NON_ALNUM, "-")
    .replace(TRIM_DASHES, "");
}
