export interface TutorialStep {
  title: string;
  description: string;
}
export interface Tutorial {
  title: string;
  steps: TutorialStep[];
}
const permissions = {
  title: "Permissions and current state",
  description:
    "Your membership determines access. The service checks each request. Refresh after a conflict before making a new decision.",
};
const paging = {
  title: "Move through records",
  description:
    "Apply supported filters before paging. Previous returns to a visited page; Next uses the service continuation. Counts describe this page, not a global total. Use Refresh for new activity.",
};
const actions = {
  title: "Submit and retry safely",
  description:
    "Review all fields before submitting. If the service times out, retry with unchanged details to reuse the operation key. A queued action is not proof of completed payment or notification delivery.",
};
export const pageTutorials: Record<string, Tutorial> = {
  "/dashboard": {
    title: "Overview",
    steps: [
      {
        title: "Read the right period",
        description:
          "Order counts and revenue use the selected UTC date window. Queues, active users, assignments and liabilities describe the current snapshot.",
      },
      permissions,
    ],
  },
  "/shipment-orders": {
    title: "Shipment operations",
    steps: [
      paging,
      {
        title: "Follow the shipment lifecycle",
        description:
          "Open a shipment for assignment, office receipt, dispatch and proof-based delivery. Available commands depend on its state, payment and fulfillment. Refresh after saving.",
      },
      actions,
    ],
  },
  "/support-tickets": {
    title: "Support",
    steps: [
      {
        title: "Check recent activity",
        description:
          "Tickets are ordered by recent activity. Open a ticket to read newest messages first, load older pages, reply or change its status. Refresh to check for new messages.",
      },
      actions,
    ],
  },
  "/export-rates": {
    title: "Shipping tariffs",
    steps: [
      {
        title: "Draft, review, publish",
        description:
          "Saving replaces a draft’s full zone and rate list. Inspect the saved tariff before publishing. Published tariffs require a new draft version for price changes.",
      },
      actions,
    ],
  },
};
export function tutorialForPath(path: string): Tutorial {
  const entry = Object.entries(pageTutorials).find(
    ([key]) => path === key || path.startsWith(key + "/"),
  );
  return (
    entry?.[1] || {
      title: "Working in this section",
      steps: [paging, permissions, actions],
    }
  );
}
export function tutorialForSection(
  title: string,
  _path: string | null,
): Tutorial {
  return { title, steps: [paging, actions] };
}
