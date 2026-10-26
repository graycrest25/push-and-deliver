import { doc, getDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { canAccessAdminScreen } from "@/lib/admin-access";

export const DHL_LOCAL_IDS = [
  "abv",
  "iba",
  "kad",
  "los",
  "phc",
  "qrw",
] as const;
export type DHLLocalId = (typeof DHL_LOCAL_IDS)[number];
export interface DHLLocalRate {
  weight: number;
  amount: number;
}
export interface DHLLocalConfig {
  currency: string;
  weightUnit: string;
  rates: DHLLocalRate[];
}
export interface DHLLocalDocument {
  id: DHLLocalId;
  config?: DHLLocalConfig;
  error?: string;
}

async function requireDHLAccess() {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to manage DHL Local rates.");
  const { claims } = await user.getIdTokenResult();
  if (
    claims.isAdmin !== true ||
    !canAccessAdminScreen(claims.adminType, "/dhl-zones")
  ) {
    throw new Error("DHL admin access is required.");
  }
}

export function validateDHLLocalConfig(value: DHLLocalConfig): DHLLocalConfig {
  if (
    !value ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency)
  ) {
    throw new Error(
      "Currency must be a three-letter uppercase code, such as NGN.",
    );
  }
  if (typeof value.weightUnit !== "string" || !value.weightUnit.trim()) {
    throw new Error("Weight unit is required.");
  }
  if (!Array.isArray(value.rates) || value.rates.length === 0) {
    throw new Error("At least one rate is required.");
  }
  const weights = new Set<number>();
  const rates = value.rates.map((rate, index) => {
    if (
      !rate ||
      !Number.isFinite(rate.weight) ||
      rate.weight <= 0 ||
      !Number.isFinite(rate.amount) ||
      rate.amount < 0
    ) {
      throw new Error(
        `Rate ${index + 1} needs a weight greater than zero and an amount of zero or greater.`,
      );
    }
    if (weights.has(rate.weight))
      throw new Error(`Duplicate weight: ${rate.weight}.`);
    weights.add(rate.weight);
    return { weight: rate.weight, amount: rate.amount };
  });
  return {
    currency: value.currency,
    weightUnit: value.weightUnit.trim(),
    rates,
  };
}

export const dhlLocalService = {
  async getDocuments(): Promise<DHLLocalDocument[]> {
    await requireDHLAccess();
    return Promise.all(
      DHL_LOCAL_IDS.map(async (id) => {
        try {
          const snapshot = await getDoc(doc(db, "DHL_LOCAL", id));
          if (!snapshot.exists()) return { id, error: "Document not found." };
          return {
            id,
            config: validateDHLLocalConfig(snapshot.data() as DHLLocalConfig),
          };
        } catch (error) {
          return {
            id,
            error:
              error instanceof Error ? error.message : "Failed to load rates.",
          };
        }
      }),
    );
  },

  async updateDocument(
    id: DHLLocalId,
    input: DHLLocalConfig,
    original: DHLLocalConfig,
  ): Promise<DHLLocalConfig> {
    await requireDHLAccess();
    if (!DHL_LOCAL_IDS.includes(id))
      throw new Error("Invalid DHL Local document.");
    const config = validateDHLLocalConfig(input);
    await runTransaction(db, async (transaction) => {
      const reference = doc(db, "DHL_LOCAL", id);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists())
        throw new Error("Document no longer exists. Reload the rates.");
      const current = validateDHLLocalConfig(snapshot.data() as DHLLocalConfig);
      if (JSON.stringify(current) !== JSON.stringify(original)) {
        throw new Error(
          "These rates changed since you loaded them. Cancel your edits and reload before saving.",
        );
      }
      // Preserve unrelated document fields and any extra fields on existing rate maps.
      const storedRates = snapshot.data().rates as Record<string, unknown>[];
      const rates = config.rates.map((rate) => ({
        ...storedRates.find((stored) => stored.weight === rate.weight),
        ...rate,
      }));
      transaction.update(reference, { ...config, rates });
    });
    return config;
  },
};
