import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
const authPersistenceReady = setPersistence(firebaseAuth, browserLocalPersistence).catch((error) => {
  console.error("Firebase auth persistence setup failed:", error);
});

if (typeof window !== "undefined" && firebaseConfig.measurementId) {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) getAnalytics(firebaseApp);
    })
    .catch(() => {});
}

const DEFAULT_ADMIN_EMAILS = ["totoriverce@gmail.com"];
const r2EvidenceApiUrl = safeStr(import.meta.env.VITE_R2_EVIDENCE_API_URL).replace(/\/+$/, "");
const r2PublicBaseUrl = safeStr(import.meta.env.VITE_R2_PUBLIC_BASE_URL || import.meta.env.VITE_R2_EVIDENCE_API_URL).replace(/\/+$/, "");

function safeStr(value) {
  return value == null ? "" : String(value);
}

function nowIso() {
  return new Date().toISOString();
}

function parseSelectColumns(selectText) {
  const raw = safeStr(selectText).trim();
  if (!raw || raw === "*") return null;
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function projectRow(row, columns) {
  if (!columns) return row;
  return Object.fromEntries(columns.map((key) => [key, row?.[key]]));
}

function normalizePattern(pattern) {
  return safeStr(pattern).replaceAll("%", "").toLowerCase();
}

function compareValue(a, b, ascending) {
  const left = a == null ? "" : a;
  const right = b == null ? "" : b;
  const result =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : safeStr(left).localeCompare(safeStr(right), "ko", { numeric: true });
  return ascending ? result : -result;
}

function upsertDocId(table, row, onConflict) {
  const conflictKey = safeStr(onConflict).split(",")[0].trim();
  const key =
    (conflictKey && row?.[conflictKey]) ??
    row?.id ??
    row?.key ??
    row?.code ??
    row?.user_id;
  return safeStr(key) || `${table}_${crypto.randomUUID()}`;
}

function normalizePayloadRows(payload) {
  return Array.isArray(payload) ? payload : [payload];
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
    );
  }

  return value;
}

function envAdminEmails() {
  const envEmails = safeStr(import.meta.env.VITE_ADMIN_EMAILS)
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...envEmails]));
}

function firebaseUserToAppUser(user) {
  if (!user) return null;

  return {
    id: user.uid,
    email: user.email,
    user_metadata: {
      full_name: user.displayName,
      name: user.displayName,
      avatar_url: user.photoURL,
    },
  };
}

async function makeSession(user, forceRefresh = false) {
  if (!user) return null;

  const [token, tokenResult] = await Promise.all([
    user.getIdToken(forceRefresh),
    user.getIdTokenResult(forceRefresh),
  ]);

  return {
    access_token: token,
    expires_at: Math.floor(new Date(tokenResult.expirationTime).getTime() / 1000),
    user: firebaseUserToAppUser(user),
  };
}

function waitForInitialAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

class FirebaseQueryBuilder {
  constructor(table) {
    this.table = table;
    this.columns = null;
    this.filters = [];
    this.ilikeFilters = [];
    this.orders = [];
    this.limitCount = null;
    this.singleMode = false;
    this.action = "select";
    this.payload = null;
    this.options = {};
  }

  select(columns = "*") {
    this.columns = parseSelectColumns(columns);
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  ilike(field, pattern) {
    this.ilikeFilters.push({ field, pattern });
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orders.push({ field, ascending });
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.singleMode = true;
    return this;
  }

  upsert(payload, options = {}) {
    this.action = "upsert";
    this.payload = payload;
    this.options = options;
    return this;
  }

  insert(payload) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    try {
      if (this.action === "select") return await this.executeSelect();
      if (this.action === "upsert") return await this.executeUpsert();
      if (this.action === "insert") return await this.executeInsert();
      if (this.action === "update") return await this.executeUpdate();
      if (this.action === "delete") return await this.executeDelete();
      return { data: null, error: null };
    } catch (error) {
      console.error(`Firebase ${this.table} ${this.action} error:`, error);
      return { data: null, error };
    }
  }

  async fetchRows() {
    const snap = await getDocs(query(collection(firestore, this.table)));
    let rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));

    for (const { field, value } of this.filters) {
      rows = rows.filter((row) => row?.[field] === value);
    }

    for (const { field, pattern } of this.ilikeFilters) {
      const needle = normalizePattern(pattern);
      rows = rows.filter((row) => safeStr(row?.[field]).toLowerCase().includes(needle));
    }

    for (let i = this.orders.length - 1; i >= 0; i -= 1) {
      const { field, ascending } = this.orders[i];
      rows = rows.sort((a, b) => compareValue(a?.[field], b?.[field], ascending));
    }

    if (Number.isFinite(this.limitCount)) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows.map((row) => projectRow(row, this.columns));
  }

  async executeSelect() {
    const rows = await this.fetchRows();
    return { data: this.singleMode ? rows[0] ?? null : rows, error: null };
  }

  async executeUpsert() {
    const rows = normalizePayloadRows(this.payload);
    const saved = [];

    for (const rawRow of rows) {
      const id = upsertDocId(this.table, rawRow, this.options?.onConflict);
      const refDoc = doc(firestore, this.table, id);
      const row = stripUndefined({
        ...rawRow,
        updated_at: rawRow?.updated_at ?? nowIso(),
      });
      await setDoc(refDoc, row, { merge: true });
      saved.push({ id, ...row });
    }

    const data = saved.map((row) => projectRow(row, this.columns));
    return { data: this.singleMode ? data[0] ?? null : data, error: null };
  }

  async executeInsert() {
    const rows = normalizePayloadRows(this.payload);
    const saved = [];

    for (const rawRow of rows) {
      const row = stripUndefined({
        ...rawRow,
        created_at: rawRow?.created_at ?? nowIso(),
      });
      const created = await addDoc(collection(firestore, this.table), row);
      saved.push({ id: created.id, ...row });
    }

    const data = saved.map((row) => projectRow(row, this.columns));
    return { data: this.singleMode ? data[0] ?? null : data, error: null };
  }

  async executeUpdate() {
    const matches = await this.matchingDocRefs();
    await Promise.all(matches.map((refDoc) => updateDoc(refDoc, stripUndefined(this.payload))));
    return { data: null, error: null };
  }

  async executeDelete() {
    const matches = await this.matchingDocRefs();
    await Promise.all(matches.map((refDoc) => deleteDoc(refDoc)));
    return { data: null, error: null };
  }

  async matchingDocRefs() {
    const snap = await getDocs(collection(firestore, this.table));
    return snap.docs
      .filter((item) => {
        const row = { id: item.id, ...item.data() };
        return this.filters.every(({ field, value }) => row?.[field] === value);
      })
      .map((item) => item.ref);
  }
}

function createStorageBucket(bucket) {
  const bucketPrefix = safeStr(bucket).replace(/^\/+|\/+$/g, "");
  const buildKey = (path) => [bucketPrefix, safeStr(path).replace(/^\/+/, "")].filter(Boolean).join("/");
  const buildUrl = (path) => `${r2PublicBaseUrl}/${buildKey(path)}`;

  return {
    async upload(path, file, options = {}) {
      try {
        if (!r2EvidenceApiUrl) throw new Error("R2 upload endpoint is not configured.");
        const user = firebaseAuth.currentUser ?? await waitForInitialAuth();
        if (!user) throw new Error("Login is required for file upload.");

        const token = await user.getIdToken();
        const fullPath = buildKey(path);
        const response = await fetch(`${r2EvidenceApiUrl}/${fullPath}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": options.contentType || file?.type || "application/octet-stream",
          },
          body: file,
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `R2 upload failed: ${response.status}`);
        }

        return { data: { path, fullPath }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    getPublicUrl(path) {
      return {
        data: {
          publicUrl: r2PublicBaseUrl ? buildUrl(path) : "",
        },
      };
    },

    async remove(paths) {
      try {
        if (!r2EvidenceApiUrl) throw new Error("R2 upload endpoint is not configured.");
        const user = firebaseAuth.currentUser ?? await waitForInitialAuth();
        if (!user) throw new Error("Login is required for file delete.");

        const token = await user.getIdToken();
        await Promise.all((paths ?? []).map(async (path) => {
          const response = await fetch(`${r2EvidenceApiUrl}/${buildKey(path)}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!response.ok && response.status !== 404) {
            const message = await response.text();
            throw new Error(message || `R2 delete failed: ${response.status}`);
          }
        }));
        return { data: null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}

export const firebaseBackend = {
  from(table) {
    return new FirebaseQueryBuilder(table);
  },

  rpc(name) {
    if (name === "my_role") {
      return (async () => {
        const user = firebaseAuth.currentUser;
        if (!user) return { data: "viewer", error: null };

        if (envAdminEmails().includes(safeStr(user.email).toLowerCase())) {
          return { data: "admin", error: null };
        }

        const { data, error } = await new FirebaseQueryBuilder("user_roles")
          .select("role")
          .eq("user_id", user.uid)
          .maybeSingle();

        return { data: data?.role ?? "viewer", error };
      })();
    }

    return Promise.resolve({ data: null, error: new Error(`Unsupported rpc: ${name}`) });
  },

  auth: {
    async signInWithOAuth({ provider }) {
      if (provider !== "google") {
        return { data: null, error: new Error(`Unsupported provider: ${provider}`) };
      }

      try {
        await authPersistenceReady;
        const googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({
          prompt: "select_account",
        });
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        return { data: { url: null, session: await makeSession(result.user) }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async getSession() {
      const user = firebaseAuth.currentUser ?? await waitForInitialAuth();
      return { data: { session: await makeSession(user) }, error: null };
    },

    async refreshSession() {
      const user = firebaseAuth.currentUser ?? await waitForInitialAuth();
      return { data: { session: await makeSession(user, true) }, error: null };
    },

    async signOut() {
      try {
        await firebaseSignOut(firebaseAuth);
        return { error: null };
      } catch (error) {
        return { error };
      }
    },

    onAuthStateChange(callback) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        callback(user ? "SIGNED_IN" : "SIGNED_OUT", await makeSession(user));
      });

      return {
        data: {
          subscription: {
            unsubscribe,
          },
        },
      };
    },
  },

  storage: {
    from(bucket) {
      return createStorageBucket(bucket);
    },
  },
};
