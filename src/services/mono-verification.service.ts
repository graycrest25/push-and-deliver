// Mono API Integration Service for NIN/BVN Verification
// Note: For production, consider proxying these calls through a backend for security

const MONO_SECRET_KEY = import.meta.env.MONO_SECRET_KEY;
const MONO_API_BASE = "https://api.withmono.com/v1";

export interface MonoVerificationResponse {
  status: string;
  message: string;
  data?: {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    date_of_birth?: string;
    phone_number?: string;
    gender?: string;
    photo?: string;
    // Additional fields from Mono API
    [key: string]: unknown;
  };
}

export interface VerificationResult {
  success: boolean;
  message: string;
  data?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    gender?: string;
  };
}

export const monoVerificationService = {
  // Verify NIN
  async verifyNIN(nin: string): Promise<VerificationResult> {
    if (!MONO_SECRET_KEY) {
      return {
        success: false,
        message: "Mono API key not configured. Please add MONO_SECRET_KEY to your environment.",
      };
    }

    if (!nin || nin.length !== 11) {
      return {
        success: false,
        message: "Invalid NIN. NIN must be exactly 11 digits.",
      };
    }

    try {
      const response = await fetch(`${MONO_API_BASE}/lookup/nin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mono-sec-key": MONO_SECRET_KEY,
        },
        body: JSON.stringify({ nin }),
      });

      const result: MonoVerificationResponse = await response.json();

      if (response.ok && result.status === "successful" && result.data) {
        return {
          success: true,
          message: "NIN verified successfully",
          data: {
            firstName: result.data.first_name,
            lastName: result.data.last_name,
            middleName: result.data.middle_name,
            dateOfBirth: result.data.date_of_birth,
            phoneNumber: result.data.phone_number,
            gender: result.data.gender,
          },
        };
      }

      return {
        success: false,
        message: result.message || "NIN verification failed",
      };
    } catch (error) {
      console.error("Error verifying NIN:", error);
      return {
        success: false,
        message: "Failed to verify NIN. Please try again.",
      };
    }
  },

  // Verify BVN
  async verifyBVN(bvn: string): Promise<VerificationResult> {
    if (!MONO_SECRET_KEY) {
      return {
        success: false,
        message: "Mono API key not configured. Please add MONO_SECRET_KEY to your environment.",
      };
    }

    if (!bvn || bvn.length !== 11) {
      return {
        success: false,
        message: "Invalid BVN. BVN must be exactly 11 digits.",
      };
    }

    try {
      const response = await fetch(`${MONO_API_BASE}/lookup/bvn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mono-sec-key": MONO_SECRET_KEY,
        },
        body: JSON.stringify({ bvn }),
      });

      const result: MonoVerificationResponse = await response.json();

      if (response.ok && result.status === "successful" && result.data) {
        return {
          success: true,
          message: "BVN verified successfully",
          data: {
            firstName: result.data.first_name,
            lastName: result.data.last_name,
            middleName: result.data.middle_name,
            dateOfBirth: result.data.date_of_birth,
            phoneNumber: result.data.phone_number,
            gender: result.data.gender,
          },
        };
      }

      return {
        success: false,
        message: result.message || "BVN verification failed",
      };
    } catch (error) {
      console.error("Error verifying BVN:", error);
      return {
        success: false,
        message: "Failed to verify BVN. Please try again.",
      };
    }
  },
};
