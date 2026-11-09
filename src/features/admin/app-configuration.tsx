import { FeatureTabs } from "./feature-tabs";
import { Heading } from "./shared";
import { DispatchSettings } from "./dispatch-settings";
import { MobileReleaseSettings } from "./release-settings";
import { SignupFunding } from "./native-dashboard";
import { GameRulesPage } from "./game-rules";

const sections = [
  { id: "dispatch", label: "Dispatch", component: DispatchSettings },
  {
    id: "releases",
    label: "Mobile releases",
    component: MobileReleaseSettings,
  },
  { id: "signup", label: "Signup bonuses", component: SignupFunding },
  { id: "game", label: "Game rules", component: GameRulesPage },
];

export function AppConfigurationPage() {
  return (
    <div className="space-y-6">
      <Heading
        title="App configuration"
        description="Manage dispatch, mobile releases, signup bonuses and game rules."
      />
      <FeatureTabs
        label="Configuration features"
        sections={sections.map(({ id, label, component: Section }) => ({
          id,
          label,
          content: <Section />,
        }))}
      />
    </div>
  );
}
