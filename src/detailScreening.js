import { decryptIfEncrypted } from "./hpkeDecryptor.js";

export function itemsFromDetailScreening(data) {
  return [
    ...(data?.screening_forms ?? []).map(f => ({
      title: (f.form_name ?? "").trim(),
      done: !!f.submit_form_date || !!f.is_skip,
      source: "table",
      layanan: null,
      code: f.form_code ?? null
    })),
    ...(data?.screening_layanan ?? []).flatMap(g =>
      (g.list_pemeriksaan ?? []).map(p => ({
        title: (p.pemeriksaan ?? "").trim(),
        done: !!p.is_submit_form || !!p.is_skip,
        source: "grid",
        layanan: (g.layanan ?? "").trim() || null,
        code: p.pemeriksaan_code ?? null
      }))
    )
  ].filter(item => item.title).map((item, idx) => ({ ...item, index: idx }));
}

export function isDetailScreeningData(data) {
  return Array.isArray(data?.screening_forms) || Array.isArray(data?.screening_layanan);
}

export async function readDetailScreening(tabId, prevDetail = null) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [prevDetail?.at ?? 0],
    func: lastAt => {
      const at = window.__ckgDetailScreeningBodyAt ?? 0;
      return at ? (at === lastAt ? { at, same: true } : { at, body: window.__ckgDetailScreeningBody ?? null }) : null;
    }
  });

  const val = res?.result;
  if (!val) return null;
  if (val.same) return prevDetail;
  const decrypted = await decryptIfEncrypted(val.body);
  return isDetailScreeningData(decrypted?.data) ? { at: val.at, data: decrypted.data } : null;
}

export function isSkippedItem(item, skipConfig) {
  if (!skipConfig || "grid" !== item?.source) return false;
  const normTitle = normalizeTitle(item.title);
  const match = (text, pattern) => !!pattern && !!text && (text.includes(normalizeTitle(pattern)) || normalizeTitle(pattern).includes(text));
  const hitTitle = (skipConfig.keywords ?? []).some(k => match(normTitle, k));
  if (hitTitle) return true;
  if (!item.layanan) return false;
  const normLayanan = normalizeTitle(item.layanan);
  return !!(skipConfig.keywords ?? []).some(k => match(normLayanan, k)) ||
    Object.entries(skipConfig.partial ?? {}).some(([k, list]) => (match(normLayanan, k) || match(normTitle, k)) && (list ?? []).some(sub => match(normTitle, sub)));
}

export function applySkip(items, skipConfig) {
  return (items ?? []).map(item => ({ ...item, skip: isSkippedItem(item, skipConfig) }));
}

export function normalizeTitle(title) {
  return (title || "").replace(/\s+/g, " ").trim().toLowerCase();
}
