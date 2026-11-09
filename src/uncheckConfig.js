// Daftar pemeriksaan non-rutin yang di-skip HANYA jika dinonaktifkan oleh user di Settings.
// PENTING: Jika di Settings berstatus ON, seluruh pemeriksaan Nakes WAJIB DIKERJAKAN!
// Skrining Mandiri WAJIB 100% DIKERJAKAN (TIDAK PERNAH DI-UNCHECK).
export const UNCHECK_KEYWORDS = [
  // Default kosong atau hanya untuk yang dinonaktifkan via toggle
];

export const UNCHECK_PARTIAL = {
  "Skrining Geriatri": ["Tindak Lanjut", "Pemeriksaan Lanjutan"]
};

export const UNCHECK_CONDITIONAL_EXCLUSIONS = [
  {
    keyword: "Pemeriksaan Kadar CO",
    excludeWhen: [
      { field: "merokok", in: ["ya"] },
      { field: "pernah-merokok", in: ["ya"] }
    ]
  }
];
