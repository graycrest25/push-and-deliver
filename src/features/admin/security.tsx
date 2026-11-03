import { Link } from "react-router-dom";
import { AuthFrame } from "@/components/auth-frame";
import { Heading, ActionForm, field } from "./shared";
function validatePassword(value: string) {
  const length = [...value].length;
  if (
    length < 8 ||
    length > 128 ||
    !/\p{L}/u.test(value) ||
    !/\p{Nd}/u.test(value)
  )
    throw new Error("Use 8–128 characters, including a letter and a digit.");
}
export function PasswordRecovery() {
  return (
    <AuthFrame>
      <div className="space-y-6">
        <Heading
          title="Reset your password"
          description="Request reset instructions by email, then use the reset token with your new password."
        />
        <ActionForm
          action={{
            title: "Request reset instructions",
            path: "/v2/auth/password-reset/request",
            fields: [field("email", "Email", { type: "email" })],
            success:
              "If this account is eligible, password reset instructions will be sent by email.",
          }}
        />
        <ActionForm
          action={{
            title: "Reset password",
            path: "/v2/auth/password-reset/confirm",
            fields: [
              field("resetToken", "Reset token from email", {
                type: "password",
              }),
              field("newPassword", "New password", {
                type: "password",
                help: "8–128 characters, including a letter and a digit. This uses the reset token, not a registration code.",
              }),
            ],
            body: (value) => {
              validatePassword(value.newPassword);
              return value;
            },
            success:
              "Password updated and sessions revoked. Sign in with your new password.",
          }}
        />
        <Link to="/sign-in" className="text-sm text-primary underline">
          Back to sign in
        </Link>
      </div>
    </AuthFrame>
  );
}
export function SecurityPage() {
  return (
    <div className="space-y-5">
      <Heading
        title="Account security"
        description="Manage your active sessions."
      />
      <ActionForm
        action={{
          title: "Sign out all sessions",
          path: "/v2/auth/logout",
          body: () => ({ revokeAllSessions: true }),
          description:
            "Revokes your sessions on every device, including this one.",
        }}
        onSuccess={() => {
          localStorage.removeItem("pnd-refresh-started");
          window.dispatchEvent(new Event("session-expired"));
        }}
      />
    </div>
  );
}
