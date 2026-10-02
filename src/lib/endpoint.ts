// Cloud Run hostname suffix, for example: -d4zsc2maqa-uc.a.run.app
const firebaseBaseUrl = import.meta.env.FIREBASE_BASE_URL;

const firebaseEndpoint = (name: string): string => {
  if (!firebaseBaseUrl) {
    throw new Error("FIREBASE_BASE_URL is not configured");
  }

  return `https://${name}${firebaseBaseUrl}`;
};

export const endpoints = {
  get resloveShipmentFee() {
    return firebaseEndpoint("resloveShipmentFee");
  },
  get listAdminUsers() {
    return firebaseEndpoint("listAdminUsers");
  },
  get manageAdminStatus() {
    return firebaseEndpoint("manageAdminStatus");
  },
  get loginAdminWithEmailAndPassword() {
    return firebaseEndpoint("loginAdminWithEmailAndPassword");
  },
  get loginAdminWithGoogle() {
    return firebaseEndpoint("loginAdminWithGoogle");
  },
  get createprefilllink() {
    return firebaseEndpoint("createprefilllink");
  },
  get updateriderprofileV2() {
    return firebaseEndpoint("updateriderprofileV2");
  },
};
