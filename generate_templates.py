"""
Generator Template Excel Resmi CKG (Cek Kesehatan Gratis - SATUSEHAT Kemenkes RI)
Mencakup seluruh kategori usia & jenis kelamin untuk Pendaftaran hingga Pelayanan Pemeriksaan Real.
Dilengkapi Excel Data Validation (Dropdown) interaktif di setiap kolom pilihan & pemeriksaan klinis.
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
import os

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates_excel")
os.makedirs(TEMPLATES_DIR, exist_ok=True)

# Styling Constants
FONT_HEADER = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
FONT_DATA = Font(name="Calibri", size=11, color="000000")

FILL_HEADER_REG = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")  # Navy: Pendaftaran
FILL_HEADER_CLINICAL = PatternFill(start_color="0D9488", end_color="0D9488", fill_type="solid")  # Teal: Pemeriksaan Klinis
FILL_HEADER_SPECIAL = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")  # Indigo: Modul Khusus

THIN_BORDER = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1")
)

# Definisi Pilihan Dropdown Sesuai Formulir Pemeriksaan Web CKG
DROPDOWN_MAP = {
    "JENIS KELAMIN": ["Laki-laki", "Perempuan"],
    "JENIS KELAMIN WALI": ["Laki-laki", "Perempuan"],
    "STATUS PERNIKAHAN": ["Belum Menikah", "Menikah", "Cerai Hidup", "Cerai Mati"],
    "PEKERJAAN": ["Tidak Bekerja", "PNS/TNI/Polri", "Pegawai Swasta", "Wiraswasta / Pedagang", "Petani / Buruh", "Ibu Rumah Tangga", "Pelajar / Mahasiswa", "Lainnya"],
    "CARA UKUR": ["Berdiri", "Terlentang"],
    "STATUS IMUNISASI": ["Lengkap", "Belum Lengkap", "Tidak Lengkap"],
    "KPSP": ["Sesuai", "Meragukan", "Penyimpangan"],
    "MCHAT": ["Normal", "Risiko Rendah", "Risiko Sedang", "Risiko Tinggi"],
    "GEJALA TBC": ["Tidak", "Ya"],
    "TBC": ["Tidak", "Ya"],
    "KUSTA": ["Tidak", "Ya"],
    "FRAMBUSIA": ["Tidak", "Ya"],
    "SKABIES": ["Tidak", "Ya"],
    "TELINGA": ["Normal", "Ada Serumen", "Infeksi", "Gangguan Dengar"],
    "MATA": ["Normal", "Rabun Jauh", "Rabun Dekat", "Silinder", "Katarak", "Lainnya"],
    "KATARAK": ["Normal", "Curiga Katarak", "Katarak"],
    "GIGI": ["Normal", "Ada Lubang", "Ada Karang Gigi", "Gusi Berdarah", "Ada Gigi Dicabut", "Lainnya"],
    "KARIES": ["Tidak Ada", "1", "2", "3", ">=4"],
    "KACAMATA": ["Tidak", "Ya"],
    "BUTA WARNA": ["Normal", "Parsial", "Total"],
    "KEBUGARAN": ["Baik Sekali", "Baik", "Cukup", "Kurang", "Kurang Sekali"],
    "MEROKOK": ["Tidak", "Ya"],
    "RIWAYAT DIABETES": ["Tidak", "Ya"],
    "RIWAYAT HIPERTENSI": ["Tidak", "Ya"],
    "MENSTRUASI": ["Teratur", "Tidak Teratur", "Dismenore", "Belum Menstruasi", "Menopause"],
    "ANEMIA": ["Tidak Anemia", "Anemia Ringan", "Anemia Sedang", "Anemia Berat"],
    "GEJALA CEMAS": ["Tidak", "Ya"],
    "GEJALA DEPRESI": ["Tidak", "Ya"],
    "SEDANG HAMIL": ["Tidak", "Ya"],
    "RENCANA MENIKAH": ["Tidak", "Ya"],
    "HUBUNGAN INTIM": ["Ya", "Tidak"],
    "SADANIS": ["Normal", "Ada Benjolan", "Curiga Ganas"],
    "IVA": ["Negatif", "Positif", "Curiga Kanker Serviks", "Tidak Dilakukan"],
    "HPV DNA": ["Negatif", "Positif", "Tidak Dilakukan"],
    "CATIN PEREMPUAN": ["Tidak", "Ya"],
    "PROTEIN URIN": ["Negatif", "Positif 1 (+)", "Positif 2 (++)", "Positif 3 (+++)", "Positif 4 (++++)"],
    "PUMA SCORE": ["Normal", "Risiko PPOK"],
    "KANKER PARU": ["Tidak Berisiko", "Berisiko"],
    "KANKER USUS": ["Tidak Berisiko", "Berisiko"],
    "KESEHATAN JIWA SRQ20": ["Normal", "Beresiko Masalah Mental"],
    "MALARIA": ["Non-Reaktif", "Reaktif", "Tidak Dilakukan"],
    "HEPATITIS B": ["Non-Reaktif", "Reaktif", "Tidak Dilakukan"],
    "HEPATITIS C": ["Non-Reaktif", "Reaktif", "Tidak Dilakukan"],
    "HIV": ["Non-Reaktif", "Reaktif", "Tidak Dilakukan"],
    "SIFILIS": ["Non-Reaktif", "Reaktif", "Tidak Dilakukan"],
    "SKILAS KOGNITIF": ["Normal", "Penurunan Kognitif"],
    "SKILAS MOBILISASI": ["Normal", "Keterbatasan Mobilisasi"],
    "SKILAS MALNUTRISI": ["Normal", "Risiko Malnutrisi"],
    "SKILAS DEPRESI": ["Normal", "Gejala Depresi"],
    "BARTHEL INDEX ADL": ["Mandiri (Skor 20)", "Ketergantungan Ringan (12-19)", "Ketergantungan Sedang (9-11)", "Ketergantungan Berat (5-8)", "Ketergantungan Total (0-4)"]
}


def style_worksheet(ws, headers_info, data_rows):
    """
    Menata style header, cell format, dan menambahkan Data Validation (Dropdown) otomatis.
    """
    ws.views.sheetView[0].showGridLines = True
    
    # 1. Baris 1: Header Kolom
    for col_idx, (h_name, fill_style) in enumerate(headers_info, 1):
        cell = ws.cell(row=1, column=col_idx, value=h_name)
        cell.font = FONT_HEADER
        cell.fill = fill_style
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
    
    ws.row_dimensions[1].height = 28
    
    # 2. Baris 2 dst: Data Baris Contoh
    for row_idx, row_data in enumerate(data_rows, 2):
        ws.row_dimensions[row_idx].height = 20
        for col_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = FONT_DATA
            cell.border = THIN_BORDER
            
            # Format text untuk NIK, No WA, Tanggal agar tidak truncated/scientific
            h_name = headers_info[col_idx - 1][0].upper().strip()
            if any(k in h_name for k in ["NIK", "WA", "HP", "TELEPON"]):
                cell.number_format = "@"
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif any(k in h_name for k in ["TANGGAL", "TGL"]):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif any(k in h_name for k in ["BB", "TB", "LP", "LK", "LILA", "SISTOLIK", "DIASTOLIK", "GULA", "KOLESTEROL", "UREUM", "KREATININ", "HB", "NADI", "RESPIRASI", "SUHU"]):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    # 3. Tambahkan Excel Data Validation (Dropdown) pada Kolom yang Sesuai
    for col_idx, (h_name, _) in enumerate(headers_info, 1):
        h_clean = h_name.upper().strip()
        if h_clean in DROPDOWN_MAP:
            opts = DROPDOWN_MAP[h_clean]
            formula_str = f'"{",".join(opts)}"'
            dv = DataValidation(type="list", formula1=formula_str, allow_blank=True)
            dv.error = f"Pilih salah satu opsi valid dari dropdown: {h_name}."
            dv.errorTitle = "Pilihan Tidak Valid"
            dv.prompt = f"Pilih opsi {h_name} dari dropdown (atau kosongkan untuk standar normal WHO/Kemenkes)."
            dv.promptTitle = f"Dropdown {h_name}"
            ws.add_data_validation(dv)
            col_letter = get_column_letter(col_idx)
            dv.add(f"{col_letter}2:{col_letter}1000")

    # 4. Auto-fit Column Widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)


# ==============================================================================
# DEFINISI DATASET & SHEET BUILDERS
# ==============================================================================

def get_balita_data():
    headers = [
        ("NIK", FILL_HEADER_REG),
        ("NAMA", FILL_HEADER_REG),
        ("TANGGAL LAHIR", FILL_HEADER_REG),
        ("JENIS KELAMIN", FILL_HEADER_REG),
        ("NO WHATSAPP", FILL_HEADER_REG),
        ("PROVINSI", FILL_HEADER_REG),
        ("KAB/KOTA", FILL_HEADER_REG),
        ("KECAMATAN", FILL_HEADER_REG),
        ("KELURAHAN", FILL_HEADER_REG),
        ("ALAMAT", FILL_HEADER_REG),
        ("STATUS PERNIKAHAN", FILL_HEADER_REG),
        ("PEKERJAAN", FILL_HEADER_REG),
        ("NIK WALI", FILL_HEADER_SPECIAL),
        ("NAMA LENGKAP WALI", FILL_HEADER_SPECIAL),
        ("TANGGAL LAHIR WALI", FILL_HEADER_SPECIAL),
        ("JENIS KELAMIN WALI", FILL_HEADER_SPECIAL),
        ("NO HP WALI", FILL_HEADER_SPECIAL),
        ("BB", FILL_HEADER_CLINICAL),
        ("TB", FILL_HEADER_CLINICAL),
        ("CARA UKUR", FILL_HEADER_CLINICAL),
        ("LK", FILL_HEADER_CLINICAL),
        ("LILA", FILL_HEADER_CLINICAL),
        ("STATUS IMUNISASI", FILL_HEADER_CLINICAL),
        ("KPSP", FILL_HEADER_CLINICAL),
        ("MCHAT", FILL_HEADER_CLINICAL),
        ("GULA DARAH", FILL_HEADER_CLINICAL),
        ("TELINGA", FILL_HEADER_CLINICAL),
        ("MATA", FILL_HEADER_CLINICAL),
        ("GIGI", FILL_HEADER_CLINICAL),
        ("GEJALA TBC", FILL_HEADER_CLINICAL),
        ("KUSTA", FILL_HEADER_CLINICAL),
        ("FRAMBUSIA", FILL_HEADER_CLINICAL),
        ("SKABIES", FILL_HEADER_CLINICAL),
    ]
    sample_rows = [
        [
            "5201096008200001", "SALMAH NAFISAH", "20/08/2021", "Perempuan", "081999578341",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah RT 02",
            "Belum Menikah", "Tidak Bekerja",
            "5201095109900005", "NURHASANAH", "11/09/1990", "Perempuan", "081999578341",
            "12.4", "88.5", "Berdiri", "48.2", "15.0", "Lengkap", "Sesuai", "Normal", "92",
            "Normal", "Normal", "Normal", "Tidak", "Tidak", "Tidak", "Tidak"
        ],
        [
            "5201091503230002", "MUHAMMAD ARKAN", "15/03/2023", "Laki-laki", "081993405632",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Betok",
            "Belum Menikah", "Tidak Bekerja",
            "5201092005920001", "AHMAD JUNAIDI", "20/05/1992", "Laki-laki", "081993405632",
            "10.2", "79.0", "Terlentang", "46.5", "14.2", "Lengkap", "Sesuai", "Normal", "88",
            "Normal", "Normal", "Normal", "Tidak", "Tidak", "Tidak", "Tidak"
        ]
    ]
    return headers, sample_rows


def get_sekolah_sd_data():
    headers = [
        ("SEKOLAH", FILL_HEADER_REG),
        ("KELAS", FILL_HEADER_REG),
        ("NIK", FILL_HEADER_REG),
        ("NAMA", FILL_HEADER_REG),
        ("TANGGAL LAHIR", FILL_HEADER_REG),
        ("JENIS KELAMIN", FILL_HEADER_REG),
        ("NO WHATSAPP", FILL_HEADER_REG),
        ("PROVINSI", FILL_HEADER_REG),
        ("KAB/KOTA", FILL_HEADER_REG),
        ("KECAMATAN", FILL_HEADER_REG),
        ("KELURAHAN", FILL_HEADER_REG),
        ("ALAMAT", FILL_HEADER_REG),
        ("BB", FILL_HEADER_CLINICAL),
        ("TB", FILL_HEADER_CLINICAL),
        ("LP", FILL_HEADER_CLINICAL),
        ("TD SISTOLIK", FILL_HEADER_CLINICAL),
        ("TD DIASTOLIK", FILL_HEADER_CLINICAL),
        ("GULA DARAH", FILL_HEADER_CLINICAL),
        ("GIGI", FILL_HEADER_CLINICAL),
        ("KARIES", FILL_HEADER_CLINICAL),
        ("MATA", FILL_HEADER_CLINICAL),
        ("KACAMATA", FILL_HEADER_CLINICAL),
        ("BUTA WARNA", FILL_HEADER_CLINICAL),
        ("TELINGA", FILL_HEADER_CLINICAL),
        ("KEBUGARAN", FILL_HEADER_CLINICAL),
        ("GEJALA TBC", FILL_HEADER_CLINICAL),
        ("KUSTA", FILL_HEADER_CLINICAL),
        ("FRAMBUSIA", FILL_HEADER_CLINICAL),
        ("SKABIES", FILL_HEADER_CLINICAL),
    ]
    sample_rows = [
        [
            "SDN 1 SESELA", "Kelas 4A", "5201091204140003", "RIZKY RAMADHAN", "12/04/2014", "Laki-laki", "081998765432",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
            "31.5", "135.0", "62", "105", "68", "95", "Normal", "Tidak Ada", "Normal", "Tidak", "Normal", "Normal", "Baik", "Tidak", "Tidak", "Tidak", "Tidak"
        ],
        [
            "SDN 1 SESELA", "Kelas 5B", "5201095508130004", "AISYAH AZZAHRA", "15/08/2013", "Perempuan", "081997654321",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Are",
            "34.0", "138.5", "64", "100", "65", "90", "Ada Lubang", "1", "Normal", "Tidak", "Normal", "Normal", "Baik Sekali", "Tidak", "Tidak", "Tidak", "Tidak"
        ]
    ]
    return headers, sample_rows


def get_remaja_data():
    headers = [
        ("SEKOLAH", FILL_HEADER_REG),
        ("KELAS", FILL_HEADER_REG),
        ("NIK", FILL_HEADER_REG),
        ("NAMA", FILL_HEADER_REG),
        ("TANGGAL LAHIR", FILL_HEADER_REG),
        ("JENIS KELAMIN", FILL_HEADER_REG),
        ("NO WHATSAPP", FILL_HEADER_REG),
        ("PROVINSI", FILL_HEADER_REG),
        ("KAB/KOTA", FILL_HEADER_REG),
        ("KECAMATAN", FILL_HEADER_REG),
        ("KELURAHAN", FILL_HEADER_REG),
        ("ALAMAT", FILL_HEADER_REG),
        ("BB", FILL_HEADER_CLINICAL),
        ("TB", FILL_HEADER_CLINICAL),
        ("LP", FILL_HEADER_CLINICAL),
        ("TD SISTOLIK", FILL_HEADER_CLINICAL),
        ("TD DIASTOLIK", FILL_HEADER_CLINICAL),
        ("GULA DARAH", FILL_HEADER_CLINICAL),
        ("HEMOGLOBIN", FILL_HEADER_CLINICAL),
        ("ANEMIA", FILL_HEADER_CLINICAL),
        ("MEROKOK", FILL_HEADER_CLINICAL),
        ("KADAR CO", FILL_HEADER_CLINICAL),
        ("MENSTRUASI", FILL_HEADER_SPECIAL),
        ("GIGI", FILL_HEADER_CLINICAL),
        ("KARIES", FILL_HEADER_CLINICAL),
        ("MATA", FILL_HEADER_CLINICAL),
        ("KACAMATA", FILL_HEADER_CLINICAL),
        ("TELINGA", FILL_HEADER_CLINICAL),
        ("KEBUGARAN", FILL_HEADER_CLINICAL),
        ("GEJALA CEMAS", FILL_HEADER_CLINICAL),
        ("GEJALA DEPRESI", FILL_HEADER_CLINICAL),
        ("GEJALA TBC", FILL_HEADER_CLINICAL),
        ("KUSTA", FILL_HEADER_CLINICAL),
        ("FRAMBUSIA", FILL_HEADER_CLINICAL),
        ("SKABIES", FILL_HEADER_CLINICAL),
    ]
    sample_rows = [
        [
            "SMPN 1 GUNUNGSARI", "Kelas 8A", "5201091010100005", "DANIEL SAPUTRA", "10/10/2010", "Laki-laki", "081991234567",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Dasan Geria",
            "48.0", "158.0", "68", "110", "70", "98", "14.2", "Tidak Anemia", "Tidak", "2", "Teratur", "Normal", "Tidak Ada", "Normal", "Tidak", "Normal", "Baik", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak"
        ],
        [
            "SMAN 1 GUNUNGSARI", "Kelas 11 IPA", "5201094503080006", "SITI MARYAM", "05/03/2008", "Perempuan", "081992345678",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
            "46.5", "154.0", "66", "108", "68", "92", "12.8", "Tidak Anemia", "Tidak", "2", "Teratur", "Normal", "Tidak Ada", "Normal", "Tidak", "Normal", "Baik", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak"
        ]
    ]
    return headers, sample_rows


def get_dewasa_laki_data():
    headers = [
        ("NIK", FILL_HEADER_REG),
        ("NAMA", FILL_HEADER_REG),
        ("TANGGAL LAHIR", FILL_HEADER_REG),
        ("JENIS KELAMIN", FILL_HEADER_REG),
        ("NO WHATSAPP", FILL_HEADER_REG),
        ("STATUS PERNIKAHAN", FILL_HEADER_REG),
        ("PEKERJAAN", FILL_HEADER_REG),
        ("PROVINSI", FILL_HEADER_REG),
        ("KAB/KOTA", FILL_HEADER_REG),
        ("KECAMATAN", FILL_HEADER_REG),
        ("KELURAHAN", FILL_HEADER_REG),
        ("ALAMAT", FILL_HEADER_REG),
        ("BB", FILL_HEADER_CLINICAL),
        ("TB", FILL_HEADER_CLINICAL),
        ("LP", FILL_HEADER_CLINICAL),
        ("TD SISTOLIK", FILL_HEADER_CLINICAL),
        ("TD DIASTOLIK", FILL_HEADER_CLINICAL),
        ("GULA DARAH", FILL_HEADER_CLINICAL),
        ("GULA DARAH PUASA", FILL_HEADER_CLINICAL),
        ("HBA1C", FILL_HEADER_CLINICAL),
        ("MEROKOK", FILL_HEADER_CLINICAL),
        ("KADAR CO", FILL_HEADER_CLINICAL),
        ("RIWAYAT DIABETES", FILL_HEADER_CLINICAL),
        ("DURASI DIABETES BULAN", FILL_HEADER_CLINICAL),
        ("RIWAYAT HIPERTENSI", FILL_HEADER_CLINICAL),
        ("KOLESTEROL TOTAL", FILL_HEADER_CLINICAL),
        ("TRIGLISERIDA", FILL_HEADER_CLINICAL),
        ("HDL", FILL_HEADER_CLINICAL),
        ("LDL", FILL_HEADER_CLINICAL),
        ("UREUM", FILL_HEADER_CLINICAL),
        ("KREATININ", FILL_HEADER_CLINICAL),
        ("PROTEIN URIN", FILL_HEADER_CLINICAL),
        ("HEMOGLOBIN", FILL_HEADER_CLINICAL),
        ("TELINGA", FILL_HEADER_CLINICAL),
        ("MATA", FILL_HEADER_CLINICAL),
        ("KATARAK", FILL_HEADER_CLINICAL),
        ("GIGI", FILL_HEADER_CLINICAL),
        ("PUMA SCORE", FILL_HEADER_CLINICAL),
        ("KANKER PARU", FILL_HEADER_CLINICAL),
        ("KANKER USUS", FILL_HEADER_CLINICAL),
        ("KESEHATAN JIWA SRQ20", FILL_HEADER_CLINICAL),
        ("TBC", FILL_HEADER_CLINICAL),
        ("KUSTA", FILL_HEADER_CLINICAL),
        ("FRAMBUSIA", FILL_HEADER_CLINICAL),
        ("SKABIES", FILL_HEADER_CLINICAL),
        ("MALARIA", FILL_HEADER_CLINICAL),
        ("HEPATITIS B", FILL_HEADER_CLINICAL),
        ("HEPATITIS C", FILL_HEADER_CLINICAL),
        ("HIV", FILL_HEADER_CLINICAL),
        ("SIFILIS", FILL_HEADER_CLINICAL),
    ]
    sample_rows = [
        [
            "5201091506880007", "AHMAD FAUZI", "15/06/1988", "Laki-laki", "081993456789",
            "Menikah", "Wiraswasta / Pedagang",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
            "68.0", "168.0", "82", "118", "78", "102", "88", "5.3",
            "Tidak", "3", "Tidak", "0", "Tidak", "182", "125", "46", "110", "24", "0.95",
            "Negatif", "14.8", "Normal", "Normal", "Normal", "Normal", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
            "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
        ]
    ]
    return headers, sample_rows


def get_dewasa_perempuan_data():
    headers = [
        ("NIK", FILL_HEADER_REG),
        ("NAMA", FILL_HEADER_REG),
        ("TANGGAL LAHIR", FILL_HEADER_REG),
        ("JENIS KELAMIN", FILL_HEADER_REG),
        ("NO WHATSAPP", FILL_HEADER_REG),
        ("STATUS PERNIKAHAN", FILL_HEADER_REG),
        ("PEKERJAAN", FILL_HEADER_REG),
        ("PROVINSI", FILL_HEADER_REG),
        ("KAB/KOTA", FILL_HEADER_REG),
        ("KECAMATAN", FILL_HEADER_REG),
        ("KELURAHAN", FILL_HEADER_REG),
        ("ALAMAT", FILL_HEADER_REG),
        ("SEDANG HAMIL", FILL_HEADER_SPECIAL),
        ("RENCANA MENIKAH", FILL_HEADER_SPECIAL),
        ("HUBUNGAN INTIM", FILL_HEADER_SPECIAL),
        ("SADANIS", FILL_HEADER_SPECIAL),
        ("IVA", FILL_HEADER_SPECIAL),
        ("HPV DNA", FILL_HEADER_SPECIAL),
        ("CATIN PEREMPUAN", FILL_HEADER_SPECIAL),
        ("BB", FILL_HEADER_CLINICAL),
        ("TB", FILL_HEADER_CLINICAL),
        ("LP", FILL_HEADER_CLINICAL),
        ("TD SISTOLIK", FILL_HEADER_CLINICAL),
        ("TD DIASTOLIK", FILL_HEADER_CLINICAL),
        ("GULA DARAH", FILL_HEADER_CLINICAL),
        ("GULA DARAH PUASA", FILL_HEADER_CLINICAL),
        ("HBA1C", FILL_HEADER_CLINICAL),
        ("MEROKOK", FILL_HEADER_CLINICAL),
        ("KADAR CO", FILL_HEADER_CLINICAL),
        ("RIWAYAT DIABETES", FILL_HEADER_CLINICAL),
        ("DURASI DIABETES BULAN", FILL_HEADER_CLINICAL),
        ("RIWAYAT HIPERTENSI", FILL_HEADER_CLINICAL),
        ("KOLESTEROL TOTAL", FILL_HEADER_CLINICAL),
        ("TRIGLISERIDA", FILL_HEADER_CLINICAL),
        ("HDL", FILL_HEADER_CLINICAL),
        ("LDL", FILL_HEADER_CLINICAL),
        ("UREUM", FILL_HEADER_CLINICAL),
        ("KREATININ", FILL_HEADER_CLINICAL),
        ("PROTEIN URIN", FILL_HEADER_CLINICAL),
        ("HEMOGLOBIN", FILL_HEADER_CLINICAL),
        ("ANEMIA", FILL_HEADER_CLINICAL),
        ("TELINGA", FILL_HEADER_CLINICAL),
        ("MATA", FILL_HEADER_CLINICAL),
        ("KATARAK", FILL_HEADER_CLINICAL),
        ("GIGI", FILL_HEADER_CLINICAL),
        ("PUMA SCORE", FILL_HEADER_CLINICAL),
        ("KANKER PARU", FILL_HEADER_CLINICAL),
        ("KANKER USUS", FILL_HEADER_CLINICAL),
        ("KESEHATAN JIWA SRQ20", FILL_HEADER_CLINICAL),
        ("TBC", FILL_HEADER_CLINICAL),
        ("KUSTA", FILL_HEADER_CLINICAL),
        ("FRAMBUSIA", FILL_HEADER_CLINICAL),
        ("SKABIES", FILL_HEADER_CLINICAL),
        ("MALARIA", FILL_HEADER_CLINICAL),
        ("HEPATITIS B", FILL_HEADER_CLINICAL),
        ("HEPATITIS C", FILL_HEADER_CLINICAL),
        ("HIV", FILL_HEADER_CLINICAL),
        ("SIFILIS", FILL_HEADER_CLINICAL),
    ]
    sample_rows = [
        [
            "5201094807920008", "NURUL HIDAYATI", "08/07/1992", "Perempuan", "081994567890",
            "Menikah", "Ibu Rumah Tangga",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Betok",
            "Tidak", "Tidak", "Ya", "Normal", "Negatif", "Negatif", "Tidak",
            "54.5", "155.0", "72", "112", "74", "98", "85", "5.2",
            "Tidak", "2", "Tidak", "0", "Tidak", "175", "115", "52", "102", "20", "0.78",
            "Negatif", "13.2", "Tidak Anemia", "Normal", "Normal", "Normal", "Normal", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
            "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
        ]
    ]
    return headers, sample_rows


def get_lansia_laki_data():
    headers = [
        ("NIK", FILL_HEADER_REG),
        ("NAMA", FILL_HEADER_REG),
        ("TANGGAL LAHIR", FILL_HEADER_REG),
        ("JENIS KELAMIN", FILL_HEADER_REG),
        ("NO WHATSAPP", FILL_HEADER_REG),
        ("STATUS PERNIKAHAN", FILL_HEADER_REG),
        ("PEKERJAAN", FILL_HEADER_REG),
        ("PROVINSI", FILL_HEADER_REG),
        ("KAB/KOTA", FILL_HEADER_REG),
        ("KECAMATAN", FILL_HEADER_REG),
        ("KELURAHAN", FILL_HEADER_REG),
        ("ALAMAT", FILL_HEADER_REG),
        ("SKILAS KOGNITIF", FILL_HEADER_SPECIAL),
        ("SKILAS MOBILISASI", FILL_HEADER_SPECIAL),
        ("CHAIR STAND DETIK", FILL_HEADER_SPECIAL),
        ("SKILAS MALNUTRISI", FILL_HEADER_SPECIAL),
        ("SKILAS DEPRESI", FILL_HEADER_SPECIAL),
        ("BARTHEL INDEX ADL", FILL_HEADER_SPECIAL),
        ("BB", FILL_HEADER_CLINICAL),
        ("TB", FILL_HEADER_CLINICAL),
        ("LP", FILL_HEADER_CLINICAL),
        ("TD SISTOLIK", FILL_HEADER_CLINICAL),
        ("TD DIASTOLIK", FILL_HEADER_CLINICAL),
        ("GULA DARAH", FILL_HEADER_CLINICAL),
        ("GULA DARAH PUASA", FILL_HEADER_CLINICAL),
        ("HBA1C", FILL_HEADER_CLINICAL),
        ("MEROKOK", FILL_HEADER_CLINICAL),
        ("KADAR CO", FILL_HEADER_CLINICAL),
        ("RIWAYAT DIABETES", FILL_HEADER_CLINICAL),
        ("DURASI DIABETES BULAN", FILL_HEADER_CLINICAL),
        ("RIWAYAT HIPERTENSI", FILL_HEADER_CLINICAL),
        ("KOLESTEROL TOTAL", FILL_HEADER_CLINICAL),
        ("TRIGLISERIDA", FILL_HEADER_CLINICAL),
        ("HDL", FILL_HEADER_CLINICAL),
        ("LDL", FILL_HEADER_CLINICAL),
        ("UREUM", FILL_HEADER_CLINICAL),
        ("KREATININ", FILL_HEADER_CLINICAL),
        ("PROTEIN URIN", FILL_HEADER_CLINICAL),
        ("HEMOGLOBIN", FILL_HEADER_CLINICAL),
        ("TELINGA", FILL_HEADER_CLINICAL),
        ("MATA", FILL_HEADER_CLINICAL),
        ("KATARAK", FILL_HEADER_CLINICAL),
        ("GIGI", FILL_HEADER_CLINICAL),
        ("PUMA SCORE", FILL_HEADER_CLINICAL),
        ("KANKER PARU", FILL_HEADER_CLINICAL),
        ("KANKER USUS", FILL_HEADER_CLINICAL),
        ("KESEHATAN JIWA SRQ20", FILL_HEADER_CLINICAL),
        ("TBC", FILL_HEADER_CLINICAL),
        ("KUSTA", FILL_HEADER_CLINICAL),
        ("FRAMBUSIA", FILL_HEADER_CLINICAL),
        ("SKABIES", FILL_HEADER_CLINICAL),
        ("MALARIA", FILL_HEADER_CLINICAL),
        ("HEPATITIS B", FILL_HEADER_CLINICAL),
        ("HEPATITIS C", FILL_HEADER_CLINICAL),
        ("HIV", FILL_HEADER_CLINICAL),
        ("SIFILIS", FILL_HEADER_CLINICAL),
    ]
    sample_rows = [
        [
            "5201091208580009", "H. MAHSUN", "12/08/1958", "Laki-laki", "081995678901",
            "Menikah", "Tidak Bekerja",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
            "Normal", "Normal", "11.2", "Normal", "Normal", "Mandiri (Skor 20)",
            "62.0", "162.0", "84", "125", "80", "110", "92", "5.6",
            "Tidak", "3", "Tidak", "0", "Tidak", "190", "135", "45", "118", "28", "1.02",
            "Negatif", "14.0", "Normal", "Normal", "Normal", "Ada Gigi Dicabut", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
            "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
        ]
    ]
    return headers, sample_rows


def get_lansia_perempuan_data():
    headers = [
        ("NIK", FILL_HEADER_REG),
        ("NAMA", FILL_HEADER_REG),
        ("TANGGAL LAHIR", FILL_HEADER_REG),
        ("JENIS KELAMIN", FILL_HEADER_REG),
        ("NO WHATSAPP", FILL_HEADER_REG),
        ("STATUS PERNIKAHAN", FILL_HEADER_REG),
        ("PEKERJAAN", FILL_HEADER_REG),
        ("PROVINSI", FILL_HEADER_REG),
        ("KAB/KOTA", FILL_HEADER_REG),
        ("KECAMATAN", FILL_HEADER_REG),
        ("KELURAHAN", FILL_HEADER_REG),
        ("ALAMAT", FILL_HEADER_REG),
        ("SKILAS KOGNITIF", FILL_HEADER_SPECIAL),
        ("SKILAS MOBILISASI", FILL_HEADER_SPECIAL),
        ("CHAIR STAND DETIK", FILL_HEADER_SPECIAL),
        ("SKILAS MALNUTRISI", FILL_HEADER_SPECIAL),
        ("SKILAS DEPRESI", FILL_HEADER_SPECIAL),
        ("BARTHEL INDEX ADL", FILL_HEADER_SPECIAL),
        ("SADANIS", FILL_HEADER_SPECIAL),
        ("IVA", FILL_HEADER_SPECIAL),
        ("BB", FILL_HEADER_CLINICAL),
        ("TB", FILL_HEADER_CLINICAL),
        ("LP", FILL_HEADER_CLINICAL),
        ("TD SISTOLIK", FILL_HEADER_CLINICAL),
        ("TD DIASTOLIK", FILL_HEADER_CLINICAL),
        ("GULA DARAH", FILL_HEADER_CLINICAL),
        ("GULA DARAH PUASA", FILL_HEADER_CLINICAL),
        ("HBA1C", FILL_HEADER_CLINICAL),
        ("MEROKOK", FILL_HEADER_CLINICAL),
        ("KADAR CO", FILL_HEADER_CLINICAL),
        ("RIWAYAT DIABETES", FILL_HEADER_CLINICAL),
        ("DURASI DIABETES BULAN", FILL_HEADER_CLINICAL),
        ("RIWAYAT HIPERTENSI", FILL_HEADER_CLINICAL),
        ("KOLESTEROL TOTAL", FILL_HEADER_CLINICAL),
        ("TRIGLISERIDA", FILL_HEADER_CLINICAL),
        ("HDL", FILL_HEADER_CLINICAL),
        ("LDL", FILL_HEADER_CLINICAL),
        ("UREUM", FILL_HEADER_CLINICAL),
        ("KREATININ", FILL_HEADER_CLINICAL),
        ("PROTEIN URIN", FILL_HEADER_CLINICAL),
        ("HEMOGLOBIN", FILL_HEADER_CLINICAL),
        ("TELINGA", FILL_HEADER_CLINICAL),
        ("MATA", FILL_HEADER_CLINICAL),
        ("KATARAK", FILL_HEADER_CLINICAL),
        ("GIGI", FILL_HEADER_CLINICAL),
        ("PUMA SCORE", FILL_HEADER_CLINICAL),
        ("KANKER PARU", FILL_HEADER_CLINICAL),
        ("KANKER USUS", FILL_HEADER_CLINICAL),
        ("KESEHATAN JIWA SRQ20", FILL_HEADER_CLINICAL),
        ("TBC", FILL_HEADER_CLINICAL),
        ("KUSTA", FILL_HEADER_CLINICAL),
        ("FRAMBUSIA", FILL_HEADER_CLINICAL),
        ("SKABIES", FILL_HEADER_CLINICAL),
        ("MALARIA", FILL_HEADER_CLINICAL),
        ("HEPATITIS B", FILL_HEADER_CLINICAL),
        ("HEPATITIS C", FILL_HEADER_CLINICAL),
        ("HIV", FILL_HEADER_CLINICAL),
        ("SIFILIS", FILL_HEADER_CLINICAL),
    ]
    sample_rows = [
        [
            "5201095012550010", "HJ. MARIAM", "10/12/1955", "Perempuan", "081996789012",
            "Cerai Mati", "Tidak Bekerja",
            "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Are",
            "Normal", "Normal", "12.0", "Normal", "Normal", "Mandiri (Skor 20)", "Normal", "Negatif",
            "52.0", "150.0", "78", "128", "82", "115", "95", "5.8",
            "Tidak", "2", "Tidak", "0", "Tidak", "195", "140", "48", "120", "26", "0.85",
            "Negatif", "12.6", "Normal", "Normal", "Normal", "Ada Gigi Dicabut", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
            "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
        ]
    ]
    return headers, sample_rows


# ==============================================================================
# CREATOR WORKBOOK TUNGGAL & MASTER MULTI-SHEET
# ==============================================================================

def create_single_template(title, sheet_name, data_getter):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name
    headers, rows = data_getter()
    style_worksheet(ws, headers, rows)
    return wb

def create_master_umum():
    """Workbook multi-sheet untuk CKG Umum dengan Dropdown Lengkap di Tiap Sheet"""
    wb = openpyxl.Workbook()
    default_sheet = wb.active

    sheets_meta = [
        ("Dewasa Laki-Laki", get_dewasa_laki_data),
        ("Dewasa Perempuan", get_dewasa_perempuan_data),
        ("Lansia Laki-Laki", get_lansia_laki_data),
        ("Lansia Perempuan", get_lansia_perempuan_data),
        ("Balita & Anak Prasekolah", get_balita_data)
    ]

    for title, getter in sheets_meta:
        ws = wb.create_sheet(title=title)
        headers, rows = getter()
        style_worksheet(ws, headers, rows)

    wb.remove(default_sheet)
    return wb

def create_master_sekolah():
    """Workbook multi-sheet untuk CKG Sekolah dengan Dropdown Lengkap di Tiap Sheet"""
    wb = openpyxl.Workbook()
    default_sheet = wb.active

    sheets_meta = [
        ("Usia Sekolah SD (7-12 Thn)", get_sekolah_sd_data),
        ("Remaja SMP-SMA (13-17 Thn)", get_remaja_data)
    ]

    for title, getter in sheets_meta:
        ws = wb.create_sheet(title=title)
        headers, rows = getter()
        style_worksheet(ws, headers, rows)

    wb.remove(default_sheet)
    return wb


def main():
    print("Membangkitkan seluruh template Excel CKG dengan Data Validation Dropdown...")

    files = {
        "Template_CKG_Balita.xlsx": create_single_template("Balita", "Balita & Anak Prasekolah", get_balita_data),
        "Template_CKG_Sekolah_SD.xlsx": create_single_template("Sekolah SD", "Usia Sekolah SD (7-12 Thn)", get_sekolah_sd_data),
        "Template_CKG_Remaja_SMP_SMA.xlsx": create_single_template("Remaja", "Remaja SMP-SMA (13-17 Thn)", get_remaja_data),
        "Template_CKG_Dewasa_Laki_Laki.xlsx": create_single_template("Dewasa Laki", "Dewasa Laki-Laki", get_dewasa_laki_data),
        "Template_CKG_Dewasa_Perempuan.xlsx": create_single_template("Dewasa Perempuan", "Dewasa Perempuan", get_dewasa_perempuan_data),
        "Template_CKG_Lansia_Laki_Laki.xlsx": create_single_template("Lansia Laki", "Lansia Laki-Laki", get_lansia_laki_data),
        "Template_CKG_Lansia_Perempuan.xlsx": create_single_template("Lansia Perempuan", "Lansia Perempuan", get_lansia_perempuan_data),
        "Template_Master_CKG_Umum.xlsx": create_master_umum(),
        "Template_Master_CKG_Sekolah.xlsx": create_master_sekolah(),
    }

    for filename, wb in files.items():
        path = os.path.join(TEMPLATES_DIR, filename)
        wb.save(path)
        print(f"[OK] Tersimpan: {filename}")

    # Perbarui juga file root standar agar sinkron & kompatibel
    root_dir = os.path.dirname(TEMPLATES_DIR)
    create_single_template("Balita", "Balita & Anak Prasekolah", get_balita_data).save(os.path.join(root_dir, "balita.xlsx"))
    create_master_umum().save(os.path.join(root_dir, "Template CKG Umum.xlsx"))
    create_master_sekolah().save(os.path.join(root_dir, "Template CKG Sekolah.xlsx"))
    print("[OK] Berhasil memperbarui file root: balita.xlsx, Template CKG Umum.xlsx, Template CKG Sekolah.xlsx")

if __name__ == "__main__":
    main()
