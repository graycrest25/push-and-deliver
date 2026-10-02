import {
  IconArrowRight,
  IconPackage,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-frame">
      <aside className="auth-brand">
        <div className="brand-lockup">
          <img src="/logo.png" alt="" width={40} height={40} className="brand-logo" />
          <span className="text-xl font-bold tracking-tight">PushNDeliver</span>
        </div>
        <div className="auth-brand-content">
          <h1>
            Keep everything
            <br />
            moving.
          </h1>
          <p>
            Orders, people, and payments.
            <br />
            One workspace to bring it all together.
          </p>
          <div className="auth-workflows">
            {[
              {
                icon: IconPackage,
                title: "Orders & deliveries",
                detail: "Follow every shipment and order.",
              },
              {
                icon: IconUsers,
                title: "People & partners",
                detail: "Connect customers, riders, and merchants.",
              },
              {
                icon: IconWallet,
                title: "Payments & operations",
                detail: "Manage fees, withdrawals, and settings.",
              },
            ].map((item) => (
              <div className="auth-workflow" key={item.title}>
                <item.icon size={22} stroke={1.6} />
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.detail}</p>
                </div>
                <IconArrowRight size={17} className="ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>
        <p className="auth-brand-footer">
          Your team. Your platform. In one place.
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-tools">
          <span className="brand-lockup text-sm font-semibold lg:hidden">
            <img src="/logo.png" alt="" width={40} height={40} className="brand-logo" />
            PushNDeliver
          </span>
          <ThemeToggle />
        </div>
        <div className="auth-form-container">{children}</div>
        <p className="auth-footer">PushNDeliver · Admin workspace</p>
      </main>
    </div>
  );
}
