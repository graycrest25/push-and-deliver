import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  GeoPoint,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import type { HeadOfficeAddress } from "@/types";

export interface NewHeadOffice {
  location: string;
  address: string;
  latitude: number;
  longitude: number;
  active: boolean;
}

export const headOfficesService = {
  async getAll(): Promise<HeadOfficeAddress[]> {
    await requireSuperAdmin();
    const snapshot = await getDocs(collection(db, "HeadOfficeAddress"));
    return snapshot.docs
      .map((entry) => ({ ...entry.data(), id: entry.id }) as HeadOfficeAddress)
      .sort(
        (a, b) =>
          (a.location || "").localeCompare(b.location || "") ||
          a.id.localeCompare(b.id),
      );
  },
  async create(input: NewHeadOffice): Promise<string> {
    await requireSuperAdmin();
    if (!input.location.trim() || !input.address.trim())
      throw new Error("Location and address are required");
    if (
      !Number.isFinite(input.latitude) ||
      input.latitude < -90 ||
      input.latitude > 90
    )
      throw new Error("Latitude must be between -90 and 90");
    if (
      !Number.isFinite(input.longitude) ||
      input.longitude < -180 ||
      input.longitude > 180
    )
      throw new Error("Longitude must be between -180 and 180");
    if (typeof input.active !== "boolean")
      throw new Error("Active must be a boolean");
    const office = await addDoc(collection(db, "HeadOfficeAddress"), {
      location: input.location.trim(),
      address: input.address.trim(),
      active: input.active,
      geolocation: new GeoPoint(input.latitude, input.longitude),
    });
    return office.id;
  },
  async setActive(id: string, active: boolean): Promise<void> {
    await requireSuperAdmin();
    if (!id.trim() || typeof active !== "boolean")
      throw new Error("A head office ID and active status are required");
    await updateDoc(doc(db, "HeadOfficeAddress", id), { active });
  },
  async delete(id: string): Promise<void> {
    await requireSuperAdmin();
    if (!id.trim()) throw new Error("A head office ID is required");
    await deleteDoc(doc(db, "HeadOfficeAddress", id));
  },
};
