import { TabSectionSkeleton } from "@/components/ui/tab-section-skeleton";
import { useCurrentUser } from "@/contexts/UserContext";
import { ActionForm, field } from "./shared";
import { CurrentRecord, currentVersion } from "./native-dashboard";

const path = "/v1/admin/config/dispatch";

export function DispatchSettings() {
  const { adminType } = useCurrentUser();
  if (adminType !== "super") return null;
  return (
    <CurrentRecord
      title="Dispatch radius"
      path={path}
      skeleton={<TabSectionSkeleton section="dispatch" />}
    >
      {(data, reload) => (
        <>
          <p className="text-sm text-muted-foreground">
            Ride and courier requests use a pickup radius of 5 km by default.
            This setting applies to push offers, available orders and
            acceptance.
          </p>
          <ActionForm
            key={data.version}
            onSuccess={reload}
            action={{
              title: "Save dispatch radius",
              path,
              method: "PUT",
              versionPath: path,
              minimumVersion: 0,
              preserveRetry: true,
              initial: { radiusKm: data.radiusKm },
              fields: [
                field("radiusKm", "Radius from pickup (km)", {
                  type: "number",
                  min: 0.1,
                  max: 20,
                  step: 0.1,
                  help: "Choose between 0.1 and 20 km.",
                }),
              ],
              body: (values) => {
                const radiusKm = Number(values.radiusKm);
                if (
                  !Number.isFinite(radiusKm) ||
                  radiusKm < 0.1 ||
                  radiusKm > 20
                )
                  throw new Error("Radius must be between 0.1 and 20 km.");
                return { radiusKm, expectedVersion: currentVersion(data) };
              },
            }}
          />
        </>
      )}
    </CurrentRecord>
  );
}
