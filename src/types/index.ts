// src/types/index.ts - Updated to match Firebase schema
import { Timestamp, GeoPoint } from "firebase/firestore";

// Type definitions (replacing enums for erasableSyntaxOnly compatibility)
export const VehicleType = {
  car: "car",
  bicycle: "bicycle",
  bike: "bike",
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const VerificationStatus = {
  unverified: 0,
  verified: 1,
  blocked: 2,
} as const;
export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const WithdrawalStatus = {
  Successful: "Successful",
  Pending: "Pending",
  Failed: "Failed",
  Reversed: "Reversed",
} as const;
export type WithdrawalStatus =
  (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

export const TransactionStatus = {
  Successful: "Successful",
  Pending: "Pending",
  Failed: "Failed",
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const TransactionType = {
  Credit: 0,
  Debit: 1,
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const FeeType = {
  fooddeliveryfee: 0,
  servicefee: 1,
  ridehauling: 2,
  freightbooking: 3,
  ridersnormalcut: 5,
} as const;
export type FeeType = (typeof FeeType)[keyof typeof FeeType];

// Interfaces
export interface Rider {
  licensePictureUrl?: string;
  referredBy?: string;
  id?: string;
  fullname?: string;
  phonenumber?: string;
  dob?: string;
  stateOfOrigin?: string;
  localGovt?: string;
  fcmtoken?: string;
  deviceName?: string;
  email?: string;
  imageUrl?: string;
  homeAddress?: string;
  vehicleType?: number;
  verificationStatus?: VerificationStatus;
  ongoingOrder?: boolean;
  vehicleMakename?: string;
  vehicleModelName?: string;
  vehicleColor?: string;
  plateNumber?: string;
  currentridelocationupdatedoc?: string;
  onlineStatus?: boolean;
  location?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };
  bankInfo?: {
    bankName?: string;
    acctName?: string;
    acctNumber?: string;
  };
  transactionPin?: string;
  walletbalance?: number;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  // Verification images
  carPictureUrl?: string | null;
  plateNumberPictureUrl?: string | null;
  driverLicensePictureUrl?: string | null;
  // NIN/BVN Verification
  ninVerified?: boolean;
  bvnVerified?: boolean;
  monoVerificationData?: {
    type: "NIN" | "BVN";
    verifiedAt?: Date;
    verifiedBy?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
  };
  // Vehicle Verification
  chassisNo?: string;
  engineNo?: string;
  statusReport?: "good" | "bad" | "fair";
  nextOfKinAddress?: string;
  nextOfKinName?: string;
  nextOfKinPhonenumber?: string;
}

export interface User {
  id?: string;
  username?: string;
  email?: string;
  phonenumber?: string;
  fcmtoken?: string;
  location?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };
  imageURL?: string;
  referralID?: string;
  deviceName?: string;
  walletbalance?: number;
  referredBy?: string;
  referralsCount?: number;
  rewardpoints?: number;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  isAdmin?: boolean;
  adminType?: "super" | "regular" | "customercare" | "verifier" | "";
}

export interface Restaurant {
  id?: string;
  legalname?: string;
  fcmtoken?: string;
  rating?: number;
  restaurantImage?: string;
  verificationStatus?: VerificationStatus;
  email?: string;
  phonenumber?: string;
  categories?: string[];
  isOpen?: boolean;
  openingHrs?: {
    monday?: { open?: string; close?: string };
    tuesday?: { open?: string; close?: string };
    wednesday?: { open?: string; close?: string };
    thursday?: { open?: string; close?: string };
    friday?: { open?: string; close?: string };
    saturday?: { open?: string; close?: string };
    sunday?: { open?: string; close?: string };
  };
  physicalAddress?: string;
  location?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };
  walletbalance?: number;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface Withdrawal {
  id?: string;
  amount?: number;
  bankname?: string;
  accountnumber?: number;
  accountname?: string;
  status?: WithdrawalStatus;
  userID?: string;
  userType?: string;
  transactionID?: string;
  createdAt?: Timestamp | Date;
}

export interface Transaction {
  id?: string;
  amount?: number;
  narration?: string;
  status?: TransactionStatus;
  trxref?: string;
  time?: Timestamp | Date;
  transactionType?: TransactionType;
  userID?: string;
}

export interface Referral {
  id?: string;
  createdAt?: Timestamp | Date;
  referralCodeUsed?: string;
  referredUid?: string;
  referrerUid?: string;
  referreduserType?: string;
  riderType?: string;
}

export interface Fee {
  id: string;
  feeType?: FeeType;
  name?: string;
  bookingFee?: number;
  perKm?: number;
  perMin?: number;
  perWeight?: number;
  minFare?: number;
  surgeMultiplier?: number;
  addedSurge?: number;
  value?: number;
}
// Legacy types (kept for compatibility, will be removed)
export interface Vendor extends Restaurant {}
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "promotion" | "alert";
  targetAudience: "all" | "users" | "riders" | "vendors";
  status: "draft" | "scheduled" | "sent";
  scheduledFor?: Date;
  sentAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface Coupon {
  id?: string;
  createdAt?: Timestamp | Date;
  isActive: boolean;
  percentageDiscount: number;
}

export interface GeneralNotification {
  id?: string;
  title: string;
  body: string;
  userType: "users" | "riders" | "restaurants" | "merchants";
  createdAt?: Timestamp | Date;
  createdBy?: string;
}

export interface DHLZone {
  code: string;
  country: string;
  zone: number;
}

export interface TicketMessage {
  id?: string;
  createdAt?: Timestamp | Date;
  message?: string;
  senderId?: string;
  timestamp?: Timestamp | Date;
  type?: "text" | "image";
  imageurl?: string;
}

export interface SupportTicket {
  id?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  lastMessage?: string;
  lastSender?: string;
  status?: "open" | "closed" | "pending";
  userId?: string;
  messages?: TicketMessage[];
}

export interface RestaurantOrderCustomer {
  email?: string;
  id?: string;
  imageUrl?: string;
  name?: string;
  phoneNumber?: string;
}

export interface RestaurantOrderLocation {
  deliveryAddress?: string;
  geohash?: string;
  geopoint?: GeoPoint;
}

export interface RestaurantOrderMenuItem {
  name?: string;
  price?: number;
  quantity?: number;
  title?: string;
}

export interface RestaurantOrderRestaurant {
  address?: string;
  id?: string;
  imageURL?: string;
  name?: string;
  phoneNumber?: string;
}

export interface RestaurantOrderStatusTimeline {
  status?: number;
  timestamp?: Timestamp | Date;
}

export interface RestaurantOrder {
  id?: string;
  createdAt?: Timestamp | Date;
  customer?: RestaurantOrderCustomer;
  declinelist?: any[];
  deliveryFee?: number;
  deliveryLocation?: RestaurantOrderLocation;
  ispaid?: boolean;
  menuItems?: RestaurantOrderMenuItem[];
  noteForRestaurant?: string;
  noteForRider?: string;
  orderStatus?: number;
  otp?: number;
  paymentType?: number; // 0 = wallet, 1 = cash
  restaurant?: RestaurantOrderRestaurant;
  restaurantLocation?: {
    geohash?: string;
    geopint?: GeoPoint;
  };
  riderID?: string;
  riderPhoneNumber?: string;
  servicefee?: number;
  statusTimeline?: RestaurantOrderStatusTimeline[];
  totalAmount?: number;
}

// Shipment Order Enums
export const ShipmentOrderStatus = {
  placed: 0,
  acceptedByRider: 1,
  sentToHq: 2,
  onrouteToDestination: 3,
  deliveredToDestination: 4,
  cancelled: 5,
  onRouteToPndHQ: 6,
} as const;
export type ShipmentOrderStatus =
  (typeof ShipmentOrderStatus)[keyof typeof ShipmentOrderStatus];

export const IntlShipmentType = {
  customclearance: 0,
  express: 1,
} as const;
export type IntlShipmentType =
  (typeof IntlShipmentType)[keyof typeof IntlShipmentType];

export const ShipmentCustomClearanceType = {
  seaconsignment: 0,
  airconsignment: 1,
} as const;
export type ShipmentCustomClearanceType =
  (typeof ShipmentCustomClearanceType)[keyof typeof ShipmentCustomClearanceType];

export interface ShipmentLocation {
  geohash?: string;
  geopoint?: GeoPoint;
}

export interface ShipmentStatusTimeline {
  status?: number;
  timestamp?: Timestamp | Date;
}

export interface ShipmentOrder {
  id?: string;
  breadthinCM?: number;
  cancelledAt?: Timestamp | Date | null;
  clearanceType?: number;
  clearancedocument?: string;
  completedAt?: Timestamp | Date | null;
  country?: string;
  createdAt?: Timestamp | Date;
  customerID?: string;
  customerName?: string;
  customerPhonenumber?: string;
  declinelist?: any[];
  dropoffAddress?: string;
  dropoffLocation?: ShipmentLocation;
  heightinCM?: number;
  invoiceUrl?: string | null;
  ispaid?: boolean;
  itemType?: string | string[]; // Can be a single string or array of strings
  itemImage?: string; // Item image URL if exists
  itemvalue?: number;
  orderStatus?: number;
  packingListUrl?: string | null;
  paymentType?: number; // 0 = wallet, 1 = cash
  pndofficeaddress?: string;
  pndofficelocation?: ShipmentLocation;
  receiveremail?: string;
  receivername?: string;
  receiverphonenumber?: string;
  riderCarColor?: string;
  riderCarModel?: string;
  riderCarName?: string;
  riderCarPlateNumber?: string;
  riderID?: string;
  riderImageURL?: string;
  riderName?: string;
  riderPhoneNumber?: string;
  senderemailaddress?: string;
  shipmentID?: string;
  shipmentType?: number; // 0 = custom clearance, 1 = express
  startoffAddress?: string;
  startoffLocation?: ShipmentLocation;
  statusTimeline?: ShipmentStatusTimeline[];
  totalAmount?: number;
  transactionID?: string;
  usedCoupon?: boolean;
  vehicleType?: string | null;
  weightinKG?: number;
  widthinCM?: number;
  zipcode?: string;
}

// Ride Hailing Enums
export const RideHaulingType = {
  regular: 0,
  discountexpress: 1,
  express: 2,
  premier: 3,
  courier: 4,
} as const;
export type RideHaulingType =
  (typeof RideHaulingType)[keyof typeof RideHaulingType];

export const RideHaulingStatus = {
  requested: 0,
  accepted: 1,
  onroute: 2,
  completed: 3,
  cancelled: 4,
  expired: 5,
  riderArrived: 6,
} as const;
export type RideHaulingStatus =
  (typeof RideHaulingStatus)[keyof typeof RideHaulingStatus];

export interface RideHaulingLocation {
  geohash?: string;
  geopoint?: GeoPoint;
}

export interface RideHaulingStatusTimeline {
  status?: number;
  timestamp?: Timestamp | Date;
}

export interface RideHaulingOrder {
  id?: string;
  cancellationReason?: string;
  cancelledAt?: Timestamp | Date | null;
  canclledBy?: string;
  completedAt?: Timestamp | Date | null;
  createdAt?: Timestamp | Date;
  customerID?: string;
  customerName?: string;
  customerPhonenumber?: string;
  declinelist?: any[];
  dropoffAddress?: string;
  dropoffLocation?: RideHaulingLocation;
  estimatedDistanceMeters?: number;
  estimatedDurationSeconds?: number;
  ispaid?: boolean;
  orderStatus?: number;
  otp?: number;
  paymentType?: number; // 0 = wallet, 1 = cash
  pndofficeaddress?: string;
  pndofficelocation?: RideHaulingLocation;
  receivername?: string;
  receiverphonenumber?: string;
  rideType?: number;
  riderCarColor?: string;
  riderCarModel?: string;
  riderCarName?: string;
  riderCarPlateNumber?: string;
  riderID?: string;
  riderImageURL?: string;
  riderLocationUpdateDocID?: string;
  riderName?: string;
  riderPhoneNumber?: string;
  riderscutpercentage?: number;
  startoffAddress?: string;
  startoffLocation?: RideHaulingLocation;
  statusTimeline?: RideHaulingStatusTimeline[];
  totalAmount?: number;
  transactionID?: string;
  usedCoupon?: boolean;
  vehicleType?: string | null;
}

// E-commerce Merchant Enums
export const EcommerceMerchantVerificationStatus = {
  unverified: 0,
  verified: 1,
} as const;
export type EcommerceMerchantVerificationStatus =
  (typeof EcommerceMerchantVerificationStatus)[keyof typeof EcommerceMerchantVerificationStatus];

// E-commerce Merchant Interfaces
export interface EcommerceMerchant {
  id?: string;
  categories?: string[];
  createdAt?: Timestamp | Date;
  currency?: string;
  displayName?: string;
  email?: string;
  fcmtoken?: string;
  isOpen?: boolean;
  legalName?: string;
  location?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };
  phonenumber?: string;
  physicalAddress?: string;
  rating?: number;
  salesMetrics?: {
    ordersCount?: number;
    totalSales?: number;
  };
  settings?: {
    autoAcceptOrders?: boolean;
    requireInventoryCheck?: boolean;
  };
  shippingProfiles?: any[];
  shopImage?: string;
  slug?: string;
  storefront?: {
    description?: string;
    featuredProductIds?: string[];
    heroImage?: string;
  };
  taxRatePercent?: number;
  updatedAt?: Timestamp | Date;
  verificationStatus?: number;
  walletBalance?: number;
}

export interface Product {
  id?: string;
  category?: string;
  color?: string | null;
  colorList?: string[];
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  description?: string;
  hasVariants?: boolean;
  imageUrls?: string[];
  isPublished?: string | boolean;
  name?: string;
  price?: number;
  sizeList?: string[];
  stock?: number;
  vendorId?: string;
  vendorName?: string;
  vendorLocation?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };
}

export interface ProductVariant {
  id?: string;
  color?: string | null;
  colorList?: string[];
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  imageUrls?: string[];
  name?: string;
  price?: number;
  productId?: string;
  sizeList?: string[];
  stock?: number;
}

export interface State {
  id: string;
  name: string;
}

export interface LGA {
  id: string;
  name: string;
  deliveryfee: number;
}

// Product Orders
export const OrderStatus = {
  Pending: 0,
  Assigned: 1,
  PickedUp: 2,
  OutForDelivery: 3,
  Delivered: 4,
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export interface OrderItem {
  // Product/Variant fields
  id?: string;
  productId?: string;
  variantId?: string;
  name?: string;
  category?: string;
  imageUrl?: string;
  imageUrls?: string[];

  // Selection
  qty?: number;
  price?: number;
  subtotal?: number;
  selectedColor?: string;
  selectedSize?: string;

  // Variant details
  color?: string | null;
  colorList?: string[];
  sizeList?: string[];
  stock?: number;
  hasVariants?: boolean;
  description?: string;
  isPublished?: string;

  // Vendor
  vendorId?: string;
  vendorName?: string;
  vendorLocation?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };

  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface ProductOrder {
  customerEmail: string;
  id?: string;
  orderId?: string;

  // Customer
  userId?: string;
  customerName?: string;
  customerPhoneNumber?: string;

  // Delivery
  deliveryaddress?: string;
  deliverylocation?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };
  lga?: string;
  state?: string;
  deliveryFee?: number;

  // Order items
  orderItems?: OrderItem[];
  total?: number;
  ispaid?: boolean;

  // Vendor
  vendorId?: string;
  vendorName?: string;
  vendorAddress?: string;
  vendorLocation?: {
    geohash?: string;
    geopoint?: GeoPoint;
  };

  // Rider
  riderid?: string;
  ridername?: string;
  riderphonenumber?: string;

  // Status
  orderstatus?: OrderStatus;
  statusTimeline?: Array<{
    status: OrderStatus;
    timestamp: Timestamp | Date;
  }>;

  // Misc
  otp?: number;
  declinelist?: string[];
  riderPayoutProcessed?: boolean;
  vendorPayoutProcessed?: boolean;

  createdAt?: Timestamp | Date;
}


export interface AppConfig {
  id?: string;
  app?: string; // "user" | "rider" etc.
  platform?: string; // "iOS" | "Android"
  appversion?: string;
  forceupdate?: boolean;
  isActive?: boolean;
  signupbonusamount?: number;
  name?: string; // e.g. "General Configuration", "Signup Bonus Configuration"
  
}

export * from "./export-rates";
