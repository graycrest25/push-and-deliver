import { adminGrowthHelp } from "./tutorials/admin-growth";
import { operationsPeopleHelp } from "./tutorials/operations-people";
import { pricingFinanceHelp } from "./tutorials/pricing-finance";
import type { FeatureHelp, Tutorial } from "./tutorials/types";

export type { Tutorial, TutorialStep } from "./tutorials/types";

const features: FeatureHelp[] = [
  ...adminGrowthHelp,
  ...operationsPeopleHelp,
  ...pricingFinanceHelp,
].sort((a, b) => b.path.length - a.path.length);

export const pageTutorials: Record<string, Tutorial> = Object.fromEntries(
  features.map(({ path, page }) => [path, page]),
);

const defaultHelp: Tutorial = {
  title: "Admin workspace",
  steps: [
    {
      title: "Choose a feature",
      description:
        "Use the menu to open the page you need. The pages and actions you can use depend on your admin role.",
    },
  ],
};

function matchingFeatures(path: string) {
  const pathname = path.split(/[?#]/)[0].replace(/\/$/, "");
  return {
    pathname,
    matches: features.filter(
      (feature) =>
        pathname === feature.path || pathname.startsWith(`${feature.path}/`),
    ),
  };
}

export function tutorialForPath(path: string): Tutorial {
  const { pathname, matches } = matchingFeatures(path);
  const feature = matches[0];
  if (!feature) return defaultHelp;
  return pathname !== feature.path && feature.detail
    ? feature.detail
    : feature.page;
}

export function tutorialForSection(
  title: string,
  path: string | null,
): Tutorial {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  for (const feature of matchingFeatures(path ?? "").matches) {
    const section = Object.entries(feature.sections ?? {}).find(
      ([key]) => normalize(key) === normalize(title),
    );
    if (section) return { ...section[1], title };
  }
  return { ...tutorialForPath(path ?? ""), title };
}
