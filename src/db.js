// Database IndexedDB untuk antrean ribuan peserta CKG
const DB_NAME = "CKG_QUEUE_DB";
const DB_VERSION = 1;
const STORE_QUEUE = "participants_queue";
const STORE_LOGS = "automation_logs";
const STORE_CHECKPOINTS = "checkpoints";

let dbInstance = null;

export async function openDB() {
  if (dbInstance) return dbInstance;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: "id", autoIncrement: true });
        queueStore.createIndex("batchId", "batchId", { unique: false });
        queueStore.createIndex("nik", "nik", { unique: false });
        queueStore.createIndex("status", "status", { unique: false });
        queueStore.createIndex("stage", "stage", { unique: false });
        queueStore.createIndex("category", "category", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        const logStore = db.createObjectStore(STORE_LOGS, { keyPath: "id", autoIncrement: true });
        logStore.createIndex("batchId", "batchId", { unique: false });
        logStore.createIndex("participantId", "participantId", { unique: false });
        logStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
        db.createObjectStore(STORE_CHECKPOINTS, { keyPath: "key" });
      }
    };

    request.onsuccess = event => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = event => {
      reject(new Error("Gagal membuka IndexedDB: " + event.target.error));
    };
  });
}

// Tambahkan kumpulan peserta dari Excel ke antrean
export async function addParticipantsBatch(batchId, category, participants) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);

    participants.forEach((p, idx) => {
      const item = {
        ...p,
        batchId,
        category: p.category || category,
        indexInBatch: idx,
        status: p.status || p._validationStatus || "READY", // READY | INVALID | IN_PROGRESS | COMPLETED | ERROR | VALID
        stage: p.stage || "IMPORTED", // IMPORTED | REGISTRATION | CONFIRM_HADIR | START_EXAM | SCREENING | NURSE_SERVICE | FINISH_SERVICE | COMPLETED
        errorMsg: p._validationError || p.errorMsg || null,
        ticketNumber: p.nomorTiket || p.ticketNumber || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.add(item);
    });

    tx.oncomplete = () => resolve(true);
    tx.onerror = event => reject(event.target.error);
  });
}

// Ambil semua data antrean batch aktif
export async function getQueueByBatch(batchId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readonly");
    const store = tx.objectStore(STORE_QUEUE);
    const index = store.index("batchId");
    const request = index.getAll(IDBKeyRange.only(batchId));

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = event => reject(event.target.error);
  });
}

// Update status, stage, nomor tiket, atau data sekolah dari satu peserta
export async function updateParticipantStatus(id, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.get(id);

    req.onsuccess = () => {
      const data = req.result;
      if (!data) return resolve(null);

      if (updates && typeof updates === "object") {
        Object.assign(data, updates);
        if (updates.ticketNumber && !data.nomorTiket) data.nomorTiket = updates.ticketNumber;
        if (updates.nomorTiket && !data.ticketNumber) data.ticketNumber = updates.nomorTiket;
        if (updates.sekolah && !data.namaSekolah) data.namaSekolah = updates.sekolah;
        if (updates.namaSekolah && !data.sekolah) data.sekolah = updates.namaSekolah;
        if (updates.kelas && !data.tingkatKelas) data.tingkatKelas = updates.kelas;
        if (updates.tingkatKelas && !data.kelas) data.kelas = updates.tingkatKelas;
      }
      data.updatedAt = new Date().toISOString();

      const putReq = store.put(data);
      putReq.onsuccess = () => resolve(data);
      putReq.onerror = event => reject(event.target.error);
    };

    req.onerror = event => reject(event.target.error);
  });
}

// Ambil item berikutnya yang siap diproses
export async function getNextReadyParticipant(batchId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readonly");
    const store = tx.objectStore(STORE_QUEUE);
    const index = store.index("batchId");
    const req = index.getAll(IDBKeyRange.only(batchId));

    req.onsuccess = () => {
      const items = req.result || [];
      const next = items.find(item => item.status === "READY");
      resolve(next || null);
    };
    req.onerror = event => reject(event.target.error);
  });
}

// Reset semua item IN_PROGRESS ke READY agar tidak macet permanen saat antrean dimulai ulang
export async function resetInProgressToReady(batchId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const index = store.index("batchId");
    const req = index.getAll(IDBKeyRange.only(batchId));

    req.onsuccess = () => {
      const items = req.result || [];
      let resetCount = 0;
      items.forEach(item => {
        if (item.status === "IN_PROGRESS" && item.stage !== "COMPLETED") {
          item.status = "READY";
          item.updatedAt = new Date().toISOString();
          store.put(item);
          resetCount++;
        }
      });
      tx.oncomplete = () => resolve(resetCount);
    };
    req.onerror = event => reject(event.target.error);
  });
}

// Reset semua item ERROR ke READY agar bisa diproses ulang
export async function resetErrorsToReady(batchId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const index = store.index("batchId");
    const req = index.getAll(IDBKeyRange.only(batchId));

    req.onsuccess = () => {
      const items = req.result || [];
      let resetCount = 0;
      items.forEach(item => {
        const isWaliInvalid = item.status === "INVALID" && item.errorMsg && (item.errorMsg.includes("Wali") || item.errorMsg.includes("Step 1") || item.errorMsg.includes("Selanjutnya"));
        if (item.status === "ERROR" || item.status === "IN_PROGRESS" || isWaliInvalid) {
          item.status = "READY";
          item.errorMsg = null;
          item.updatedAt = new Date().toISOString();
          store.put(item);
          resetCount++;
        }
      });
      tx.oncomplete = () => resolve(resetCount);
    };
    req.onerror = event => reject(event.target.error);
  });
}

// Hitung statistik ringkasan antrean
export async function getQueueStats(batchId) {
  const items = await getQueueByBatch(batchId);
  const stats = {
    total: items.length,
    ready: 0,
    inProgress: 0,
    completed: 0,
    error: 0,
    invalid: 0,
    alreadyScreened: 0,
    valid: 0
  };

  items.forEach(it => {
    const s = String(it.status || "").toUpperCase();
    if (s === "READY") stats.ready++;
    else if (s === "IN_PROGRESS") stats.inProgress++;
    else if (s === "COMPLETED" || s === "VALID") {
      stats.completed++;
      stats.valid++;
    }
    else if (s === "ALREADY_SCREENED" || s === "SUDAH_CKG") stats.alreadyScreened++;
    else if (s === "ERROR") stats.error++;
    else if (s === "INVALID") stats.invalid++;
    else stats.ready++;
  });

  return stats;
}

// Hapus batch data
export async function clearBatch(batchId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE, STORE_LOGS], "readwrite");
    const qStore = tx.objectStore(STORE_QUEUE);
    const index = qStore.index("batchId");
    const req = index.openCursor(IDBKeyRange.only(batchId));

    req.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = event => reject(event.target.error);
  });
}

// Simpan / Ambil Checkpoint
export async function setCheckpoint(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CHECKPOINTS], "readwrite");
    tx.objectStore(STORE_CHECKPOINTS).put({ key, value, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = event => reject(event.target.error);
  });
}

export async function getCheckpoint(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CHECKPOINTS], "readonly");
    const req = tx.objectStore(STORE_CHECKPOINTS).get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = event => reject(event.target.error);
  });
}

// Tambah log
export async function appendLog({ batchId, participantId, level = "INFO", message }) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_LOGS], "readwrite");
    tx.objectStore(STORE_LOGS).add({
      batchId,
      participantId,
      level,
      message,
      timestamp: new Date().toISOString()
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = event => reject(event.target.error);
  });
}

// Ambil semua pasien yang sudah terdaftar & memiliki tiket / status VALID dari pendaftaran
export async function getAllRegisteredPatients() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.getAll();

    req.onsuccess = () => {
      const items = req.result || [];
      // HANYA pasien yang berstatus VALID / COMPLETED / memiliki nomor tiket resmi dari pendaftaran!
      // Pasien yang sudah selesai dilayani (COMPLETED) TETAP TAMPIL dengan status Sukses sampai tombol "Hapus yang Berhasil" diklik!
      const registered = items.filter(it => {
        const st = String(it.status || "").toUpperCase();
        const sg = String(it.stage || "").toUpperCase();
        const hasTicket = Boolean((it.ticketNumber && it.ticketNumber !== "—") || (it.nomorTiket && it.nomorTiket !== "—"));

        if (st === "COMPLETED" || sg === "COMPLETED") {
          return true;
        }
        if (st === "VALID" || st === "REGISTERED" || st === "DONE_PENDAFTARAN") {
          return true;
        }
        if (hasTicket) {
          return true;
        }
        return false;
      });
      resolve(registered);
    };
    req.onerror = event => reject(event.target.error);
  });
}

// Ambil pasien berdasarkan ID
export async function getPatientById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = event => reject(event.target.error);
  });
}

// Hapus pasien yang sudah berstatus COMPLETED dari antrean
export async function deleteCompletedRegisteredPatients(specificIds = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.openCursor();
    let count = 0;

    req.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        const item = cursor.value;
        const matchesSpecific = Array.isArray(specificIds) && specificIds.length > 0 && specificIds.some(id => String(id) === String(item.id));
        const isCompleted = (item.status || "").toUpperCase() === "COMPLETED" || (item.stage || "").toUpperCase() === "COMPLETED";

        if (matchesSpecific || (!specificIds && isCompleted)) {
          cursor.delete();
          count++;
        }
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    req.onerror = event => reject(event.target.error);
  });
}

// Hapus semua pasien terdaftar dari antrean
export async function clearAllRegisteredPatients(specificIds = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE], "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.openCursor();
    let count = 0;

    req.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        const it = cursor.value;
        const matchesSpecific = Array.isArray(specificIds) && specificIds.length > 0 && specificIds.some(id => String(id) === String(it.id));
        const isRegistered = Boolean(
          it.ticketNumber || it.nomorTiket ||
          ["CONFIRM_HADIR", "START_EXAM", "NURSE_SERVICE", "FINISH_SERVICE", "COMPLETED"].includes(it.stage) ||
          it.status === "DONE_PENDAFTARAN" ||
          it.status === "ALREADY_SCREENED" ||
          it.status === "VALID" ||
          it.status === "COMPLETED"
        );

        if (matchesSpecific || (!specificIds && isRegistered)) {
          cursor.delete();
          count++;
        }
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    req.onerror = event => reject(event.target.error);
  });
}



