// Labels are presentation only. Keep the original API values in requests.
const keyName = (key: string) => key.replace(/[_\s-]/g, "").toLowerCase();
const labels: Record<string, string> = {
  super: "Super admin",
  regular: "Regular admin",
  customercare: "Customer care",
  verifier: "Verifier",
  none: "No administrator access",
  user: "User",
  rider: "Rider",
  vendor: "Vendor",
  ecommerce_merchant: "Ecommerce merchant",
  unverified: "Unverified",
  verified: "Verified",
  blocked: "Blocked",
  deleted: "Deleted",
  unknown: "Unknown",
  incomplete: "Incomplete",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  unavailable: "Unavailable",
  car: "Car",
  bicycle: "Bicycle",
  bycicle: "Bicycle",
  bike: "Motorbike",
  motorbike: "Motorbike",
  standard: "Standard",
  discountexpress: "Discount express",
  express: "Express",
  premier: "Premier",
  courier: "Courier",
  ridehailing: "Ride hailing",
  ride_courier: "Rides and courier",
  local: "Local",
  customs_clearance: "Customs clearance",
  sea: "Sea",
  air: "Air",
  placed: "Placed",
  acceptedByRider: "Accepted by rider",
  sentToHq: "Sent to HQ",
  onrouteToDestination: "En route to destination",
  deliveredToDestination: "Delivered to destination",
  onRouteToPndHQ: "En route to PND HQ",
  requested: "Requested",
  accepted: "Accepted",
  onroute: "En route",
  onRoute: "En route",
  riderarrived: "Rider arrived",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  wallet: "Wallet",
  cash: "Cash",
  paystack: "Paystack",
  paid: "Paid",
  unpaid: "Unpaid",
  not_required: "Not required",
  assessed: "Assessed",
  due: "Due",
  initializing: "Initializing",
  refunded: "Refunded",
  success: "Successful",
  succeeded: "Successful",
  failed: "Failed",
  reversed: "Reversed",
  credit: "Credit",
  debit: "Debit",
  initial: "Initial charge",
  additional_fee: "Additional charge",
  direct: "Direct delivery",
  clearance_completed: "Clearance completed",
  draft: "Draft",
  active: "Active",
  retired: "Retired",
  document: "Document",
  non_document: "Non-document",
  dhl: "DHL",
  export: "Export",
  import: "Import",
  abv: "Abuja",
  iba: "Ibadan",
  kad: "Kaduna",
  los: "Lagos",
  phc: "Port Harcourt",
  qrw: "Warri",
  within_state: "Within state",
  open: "Open",
  closed: "Closed",
  support: "Support",
  text: "Text",
  image: "Image",
  manual_bank_transfer: "Manual bank transfer",
  "manual-bank-transfer": "Manual bank transfer",
  submitting: "Submitting",
  otp: "Awaiting transfer verification",
  running: "Running",
  dead: "Needs investigation",
  ready: "Ready",
  awaiting_upload: "Awaiting upload",
  processing: "Processing",
  queued: "Queued",
  admins: "Administrators",
  non_admins: "Non-admin users",
  all: "All",
  all_eligible: "All eligible campaigns",
  selected: "Selected campaigns",
  legacy_profile: "Historical profile",
  minor: "Kobo",
  major: "Naira",
  ppm: "Parts per million",
  multiplier: "Multiplier",
};
const ordinal: Record<string, Record<string, string>> = {
  verificationstatus: {
    0: "Unverified",
    1: "Verified",
    2: "Blocked",
    3: "Deleted",
  },
  vehicletype: { 0: "Car", 1: "Bicycle", 2: "Motorbike" },
  ridetype: {
    0: "Standard",
    1: "Discount express",
    2: "Express",
    3: "Premier",
    4: "Courier",
  },
  shipmenttype: { 0: "Customs clearance", 1: "Express" },
  clearancetype: { 0: "Sea", 1: "Air" },
  paymenttype: { 0: "Wallet", 1: "Cash" },
  transactionstatus: {
    0: "Successful",
    1: "Pending",
    2: "Failed",
    3: "Reversed",
  },
  transactiontype: { 0: "Credit", 1: "Debit" },
  feetype: {
    0: "Food pricing",
    1: "Food pricing",
    2: "Car fares",
    3: "Freight pricing",
    4: "Rider pickup compensation",
    5: "Rider revenue share",
    6: "Courier motorbike fares",
    7: "Courier bicycle fares",
    8: "Food percentage fee",
    9: "Ecommerce percentage fee",
    10: "Delivery policy",
    11: "Delivery policy",
  },
};
const enumKeys = new Set([
  "status",
  "state",
  "accounttype",
  "admintype",
  "verificationstatus",
  "vehicletype",
  "ridetype",
  "shipmenttype",
  "clearancetype",
  "paymenttype",
  "paymentmethod",
  "method",
  "payoutmethod",
  "feetypename",
  "feetype",
  "direction",
  "cargo",
  "service",
  "origincity",
  "decision",
  "senderrole",
  "lastsender",
  "applicationstatus",
  "assessmentstatus",
  "paymentstatus",
  "refundstatus",
  "clearancestatus",
  "deliveryroute",
  "dataquality",
  "selection",
  "membership",
  "moneyunit",
  "localzone",
  "localtype",
  "source",
  "kind",
  "purpose",
  "action",
  "jobtype",
  "type",
  "targetstatus",
  "assessmenttype",
  "report",
  "app",
  "platform",
  "allowedadminactions",
  "alloweddecisions",
  "eligibleservices",
  "invalidfields",
  "unavailablefields",
  "changedfields",
]);
export function readableEnum(value: string) {
  return (
    labels[value] ||
    value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_.-]+/g, " ")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}
export function enumLabel(
  key: string,
  value: unknown,
  scope = "",
): string | undefined {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "object"
  )
    return;
  const name = keyName(key),
    context = keyName(scope);
  if (context === "units") return readableEnum(String(value));
  if (
    name === "zone" &&
    typeof value === "string" &&
    ["abv", "iba", "kad", "los", "phc", "qrw"].includes(value)
  )
    return readableEnum(value);
  if (!enumKeys.has(name)) return;
  let mapping = ordinal[name];
  if (
    name === "type" &&
    (context === "vehicle" || context === "vehicleinformation")
  )
    mapping = ordinal.vehicletype;
  if (name === "status") {
    if (/shipment/.test(context))
      mapping = {
        0: "Placed",
        1: "Accepted by rider",
        2: "Sent to HQ",
        3: "En route to destination",
        4: "Delivered to destination",
        5: "Cancelled",
        6: "En route to PND HQ",
      };
    else if (/(?:^|\/)(rides|ride|ridehailing)(?:\/|$)/.test(context))
      mapping = {
        0: "Requested",
        1: "Accepted",
        2: "En route",
        3: "Completed",
        4: "Cancelled",
        5: "Expired",
        6: "Rider arrived",
      };
    else if (/transaction/.test(context)) mapping = ordinal.transactionstatus;
    else if (/withdrawal/.test(context))
      mapping = { 0: "Completed", 1: "Pending", 2: "Failed", 3: "Reversed" };
  }
  const text = String(value);
  if (typeof value === "number" || /^\d+$/.test(text))
    return (
      mapping?.[text] ||
      `Unknown ${
        name === "type"
          ? "type"
          : name
              .replace(/status$/, " status")
              .replace(/type$/, " type")
              .trim()
      }`
    );
  return readableEnum(text);
}
