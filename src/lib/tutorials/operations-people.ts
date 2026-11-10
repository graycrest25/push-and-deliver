import type { FeatureHelp } from "./types";

const guide = (
  title: string,
  ...steps: [title: string, description: string][]
): FeatureHelp["page"] => ({
  title,
  steps: steps.map(([title, description]) => ({ title, description })),
});

const accountTotals = guide(
  "Account totals",
  [
    "Choose users or riders",
    "Use Account summary above this section to choose the account group. User totals show registrations; rider totals show verification and vehicle groups.",
  ],
  [
    "Check when totals were calculated",
    "The calculation time appears below the figures. Use Refresh account totals to request the latest available report.",
  ],
);

const orderTotals = guide(
  "Order totals",
  [
    "Choose the order group",
    "Use Order summary above this section to switch between shipments and rides and courier. Read the status, payment and revenue figures for that group.",
  ],
  [
    "Check missing totals",
    "Unavailable means a total could not be confirmed, not that it is zero. If report preparation is pending, inspect coverage before relying on the figures.",
  ],
  [
    "Refresh the report",
    "Check the calculation time below the totals. Refresh order totals requests an updated report.",
  ],
);

const reportCoverage = guide(
  "Report coverage",
  [
    "Check what the report includes",
    "Read the coverage details before using the totals. Missing source records can leave a report incomplete.",
  ],
  [
    "Keep gaps visible",
    "Treat unavailable or incomplete figures as missing information. A super administrator can inspect Report coverage to check preparation progress.",
  ],
);

const profileSections = {
  "Personal information": guide(
    "Personal information",
    [
      "Check the account details",
      "Review the person's name, contact details and saved profile information. A missing sign-in identity means this saved profile has no linked login.",
    ],
    [
      "Correct personal information",
      "Use Edit user information at the top of the profile and explain the change. Email or main phone changes sign the account out; changing email also requires verification and removes linked social sign-in.",
    ],
  ),
  Verification: guide(
    "Verification",
    [
      "Read each account flag",
      "Verification, Disabled and Deleted describe different parts of the account. Read them together before deciding whether the account is ready to use.",
    ],
    [
      "Check contact verification",
      "Check Email verified in Personal information when investigating sign-in readiness. Changing an email requires it to be verified again.",
    ],
  ),
  Wallet: guide(
    "Wallet",
    [
      "Read the current balances",
      "This section shows the account's reported wallet balances. An unavailable balance is not a zero balance.",
    ],
    [
      "Check recent activity separately",
      "Use Refresh current balances for an updated balance. Transaction history below explains individual movements; one page of transactions is not the full wallet balance.",
    ],
  ),
  "Current balances": guide(
    "Current balances",
    [
      "Check the wallet figures",
      "Read each balance with its label and currency. Missing figures remain unavailable.",
    ],
    [
      "Refresh after a payment",
      "Use Refresh current balances to check the latest reported amount. Compare it with Transaction history when investigating a payment.",
    ],
  ),
  "Transaction history": guide(
    "Transaction history",
    [
      "Inspect a movement",
      "Check its direction, amount, status, narration and reference. A reversal points back to the original transaction when that information is available.",
    ],
    [
      "Follow the related order",
      "Open a related shipment or ride from its link to see the order behind a transaction. Use the page controls to inspect more entries.",
    ],
  ),
};

const orderStatus = guide(
  "Order status",
  [
    "Read the current stage",
    "This is the latest recorded stage of the order. It does not, by itself, confirm that a customer payment or rider payment has completed.",
  ],
  [
    "Check the history",
    "Look at the status history for recorded changes. Refresh the order after an update to confirm its current stage.",
  ],
);

const paymentType = guide(
  "Payment type",
  [
    "Identify the payment method",
    "Read the payment method recorded for the customer. Check Payment information for the amount and other payment details.",
  ],
  [
    "Understand a blank value",
    "Cancelled orders, and expired rides, hide the payment-type summary. A blank value is not confirmation of payment or a refund.",
  ],
);

const totalAmount = guide(
  "Total amount",
  [
    "Read the recorded total",
    "This is the order's reported total, shown in its currency. It is not a confirmation that the customer has paid.",
  ],
  [
    "Check the price breakdown",
    "Use Payment information to compare the gross amount, discount and total. Missing amounts remain unavailable.",
  ],
);

const orderDates = guide(
  "Dates",
  [
    "Check when events happened",
    "Compare the available creation, completion and cancellation dates. Displayed times use Africa/Lagos, shown as WAT.",
  ],
  [
    "Keep missing dates distinct",
    "A blank date means no value was returned for that event. Use the status history for additional recorded changes.",
  ],
);

export const operationsPeopleHelp: FeatureHelp[] = [
  {
    path: "/dashboard",
    page: guide(
      "Overview",
      [
        "Choose what to review",
        "Switch Account summary between users and riders. Use Order summary to switch between shipments and rides and courier when your role has access.",
      ],
      [
        "Read the totals in context",
        "User totals include recent registrations; rider totals group verification and vehicle types. Order totals separate status, payment and revenue figures.",
      ],
      [
        "Check freshness and coverage",
        "Each report shows its calculation time and has a refresh button. Unavailable totals need investigation, not a zero assumption; super administrators can open Report coverage.",
      ],
    ),
    sections: { "Account totals": accountTotals, "Order totals": orderTotals },
  },
  {
    path: "/reports",
    page: guide(
      "Account and order reports",
      [
        "Select the report group",
        "Choose users or riders for the account report. Choose shipments or rides and courier for the order report.",
      ],
      [
        "Review the reported figures",
        "Compare the labelled totals and check their calculation time. These summary cards do not have a custom date-range filter.",
      ],
      [
        "Follow up on unavailable data",
        "Refresh the affected report or inspect its coverage when preparation is pending. Keep unavailable amounts separate from confirmed zero values.",
      ],
    ),
    sections: { "Account totals": accountTotals, "Order totals": orderTotals },
  },
  {
    path: "/weekly-overview",
    page: guide(
      "Weekly overview",
      [
        "Choose the reporting period",
        "Enter up to 52 weeks and an optional Through date, then choose Apply report options. Dates and week boundaries use Africa/Lagos.",
      ],
      [
        "Compare the weeks",
        "Read Weekly breakdown alongside Report information to understand the period returned. Leave the options blank to use the report's defaults.",
      ],
      [
        "Check coverage",
        "Review Report coverage before comparing results. Incomplete source information can affect the figures.",
      ],
    ),
    sections: {
      "Report options": guide(
        "Weekly report options",
        [
          "Set the period",
          "Choose 1–52 weeks and, if needed, a Through date. Leave either field blank to use its default.",
        ],
        [
          "Apply your choices",
          "Choose Apply report options to load the new period. Weeks are interpreted in Africa/Lagos.",
        ],
      ),
      "Report information": guide(
        "Weekly report information",
        [
          "Confirm the returned period",
          "Read the report's dates and other summary details before comparing weeks.",
        ],
        [
          "Check the supporting sections",
          "Use Weekly breakdown for the figures by week and Report coverage for any missing source information.",
        ],
      ),
      "Weekly breakdown": guide(
        "Weekly breakdown",
        [
          "Compare like periods",
          "Read each week's dates alongside its figures. Use the same report options when comparing results across visits.",
        ],
        [
          "Check unusual changes",
          "Review coverage before treating a sudden increase or decrease as a business trend.",
        ],
      ),
      "Report coverage": reportCoverage,
    },
  },
  {
    path: "/analytics-coverage",
    page: guide(
      "Report coverage",
      [
        "Choose the report",
        "Select the report whose totals you need to check. Source readiness shows whether the report is complete.",
      ],
      [
        "Identify unfinished work",
        "Review pending changes and the latest rebuild. A queued or running rebuild does not mean the totals are ready.",
      ],
      [
        "Rebuild when needed",
        "Use the available maintenance action to request a rebuild. If a job failed, investigate that failure before requesting another.",
      ],
      [
        "Confirm completion",
        "The page checks progress for up to two minutes. Use Continue checking readiness or Refresh coverage if the work is still running.",
      ],
    ),
    sections: {
      "Source readiness": guide(
        "Source readiness",
        [
          "Look for Complete",
          "A complete report has a successful rebuild and no outstanding source or processing changes.",
        ],
        [
          "Check pending requirements",
          "Read the three readiness checks to see what remains. Not ready or Unavailable means complete totals have not been confirmed.",
        ],
      ),
      "Processing diagnostics": guide(
        "Processing diagnostics",
        [
          "Compare the record counts",
          "The counts show how many source records have been captured for reporting and how much work remains.",
        ],
        [
          "Watch outstanding changes",
          "Capture pending and Projection pending should clear as processing finishes. Refresh coverage to check progress.",
        ],
      ),
      "Latest backfill": guide(
        "Latest report rebuild",
        [
          "Check the last rebuild",
          "Read its status, processed-record count, attempts and completion time. No history means the page has no rebuild result to show.",
        ],
        [
          "Distinguish queued from finished",
          "Queued and Running mean work is still in progress. A failed job needs investigation before another rebuild.",
        ],
      ),
      "Report maintenance": guide(
        "Report maintenance",
        [
          "Request the available rebuild",
          "Open the maintenance action and submit it when the report needs preparation. Rebuild order reports covers both shipments and rides and courier.",
        ],
        [
          "Wait for readiness",
          "An accepted request starts background work. Confirm Source readiness is Complete before relying on the totals.",
        ],
      ),
      "Order totals": guide(
        "Prepared order totals",
        [
          "Read each order group",
          "These totals are loaded after order-report coverage is complete. Shipments and rides and courier are shown separately.",
        ],
        [
          "Refresh or open the overview",
          "Refresh order totals checks the figures again. Open overview shows the fuller order summaries.",
        ],
      ),
    },
  },
  {
    path: "/users",
    page: guide(
      "Users",
      [
        "Find a user",
        "Search all or part of a name, email or phone number. Open a row to inspect the account profile.",
      ],
      [
        "Review account details",
        "The profile brings together contact information, verification, wallet balances and transactions. Available editing controls depend on your role.",
      ],
      [
        "Download matching users",
        "Open Export users and review the filters copied from the directory. Choose CSV or JSON; all matches download in one file after it finishes successfully.",
      ],
    ),
    detail: guide(
      "User profile",
      [
        "Review the account",
        "Use the profile links to jump to personal information, verification, wallet and transactions.",
      ],
      [
        "Make a correction",
        "Use Edit user information to change saved details and explain why. Email and main phone changes sign the account out; an email change requires verification again.",
      ],
      [
        "Check financial activity",
        "Read Current balances separately from Transaction history. Open a related order when you need to investigate a movement.",
      ],
    ),
    sections: {
      ...profileSections,
      Records: guide(
        "Find users",
        [
          "Search the directory",
          "Enter part of a name, email or phone number, then apply the search. Names and emails ignore letter case; phone searches ignore spaces and punctuation.",
        ],
        [
          "Open the right account",
          "Check the contact and verification columns, then open the row. Use Previous and Next to browse more accounts.",
        ],
      ),
      "Export users": guide(
        "Export users",
        [
          "Review the filters",
          "The export starts with the directory's applied search. You can also set an exact email or a registration date range; enter both dates or leave both blank.",
        ],
        [
          "Download one complete file",
          "Choose CSV or JSON, then Download export. The file contains all matching users and is saved only after the download finishes.",
        ],
      ),
      "Administrator access": guide(
        "Administrator access",
        [
          "Check the current role",
          "Super administrators can inspect and change this user's administrator role.",
        ],
        [
          "Explain the access change",
          "Choose the intended role and enter a reason. Changing access signs the account out of its existing sessions.",
        ],
      ),
      "Account role": guide(
        "Account role",
        [
          "Choose the intended access",
          "Review the current role before changing it. None removes administrator access.",
        ],
        [
          "Save with a reason",
          "Explain why access is changing. The account must be verified and enabled to receive administrator access, and the change signs it out.",
        ],
      ),
    },
  },
  {
    path: "/user-activation",
    page: guide(
      "User activation",
      [
        "Understand activation",
        "This report shows whether users placed a first order and how long it took after registration.",
      ],
      [
        "Compare summary and records",
        "Read Activation summary for the overall picture, then browse User activation records for individual accounts. Summary totals are not limited to the visible page.",
      ],
      [
        "Check missing information",
        "Read Report coverage before interpreting missing first-order dates. Use the displayed status to understand each record.",
      ],
    ),
    sections: {
      "Activation summary": guide(
        "Activation summary",
        [
          "Read the overall result",
          "Review the returned counts and activation measures together. They describe the report, not just the accounts on the visible page.",
        ],
        [
          "Check the underlying records",
          "Use User activation records to compare registration and first-order dates. Check Report coverage for missing source information.",
        ],
      ),
      "User activation records": guide(
        "User activation records",
        [
          "Read one user's timeline",
          "Compare Created at, First order at and Time to first order days. Read Status when a date or interval is missing.",
        ],
        [
          "Browse more users",
          "Use the page controls to inspect additional accounts. The summary above continues to describe the full report.",
        ],
      ),
      "Report information": guide(
        "Activation report information",
        [
          "Check the measurement date",
          "The report date identifies when the activation results were measured.",
        ],
        [
          "Read it with coverage",
          "Use Report coverage to see whether the available source information is complete.",
        ],
      ),
      "Report coverage": reportCoverage,
    },
  },
  {
    path: "/weekly-concentration",
    page: guide(
      "Weekly concentration",
      [
        "Choose a week and group size",
        "Select Top users and a Week containing date, then apply the options. The selected date determines the week in Africa/Lagos.",
      ],
      [
        "Compare the leading users",
        "Read User order concentration to see how activity is distributed among the returned users.",
      ],
      [
        "Check the report's scope",
        "Review Report information and coverage before comparing weeks or drawing conclusions from missing figures.",
      ],
    ),
    sections: {
      "Report options": guide(
        "Concentration report options",
        [
          "Choose who to include",
          "Select the top 10, 20, 50 or 100 users. Enter a date within the week you want to inspect.",
        ],
        [
          "Load the selected week",
          "Choose Apply report options. Week boundaries use Africa/Lagos.",
        ],
      ),
      "Report information": guide(
        "Concentration report information",
        [
          "Confirm the week",
          "Check the returned period before comparing this report with another week.",
        ],
        [
          "Read the user breakdown",
          "User order concentration contains the selected leading users. Report coverage explains gaps in the supporting data.",
        ],
      ),
      "User order concentration": guide(
        "User order concentration",
        [
          "Compare user activity",
          "Read the order figures shown for each returned user. The Top users option controls how many leading users are included.",
        ],
        [
          "Keep the week consistent",
          "Compare these figures only with the selected reporting week. Change Report options to inspect a different period.",
        ],
      ),
      "Report coverage": reportCoverage,
    },
  },
  {
    path: "/riders",
    page: guide(
      "Riders",
      [
        "Find the rider",
        "Search by name, email or phone, or filter by vehicle and verification status. Date filters cover registration and include both selected days in Africa/Lagos.",
      ],
      [
        "Inspect the profile",
        "Open a rider to review contact details, vehicle information and payments. Online is a saved account status, not a live connection check.",
      ],
      [
        "Review the application",
        "Use the profile's application link to inspect photos, requirements and review history. Approval happens on the application page.",
      ],
      [
        "Export all matches",
        "Open Export riders and confirm the copied filters. CSV or JSON downloads all matches in one complete file, regardless of the current directory page.",
      ],
    ),
    detail: guide(
      "Rider profile",
      [
        "Review the rider's details",
        "Use the section links to inspect contact information, verification, vehicle details, wallet balances and transactions.",
      ],
      [
        "Correct the right information",
        "Use Edit rider information for personal details or Edit vehicle information for the vehicle. Vehicle changes return the rider to pending review and take them offline.",
      ],
      [
        "Review approval separately",
        "Open Inspect application and review history to check the photos and make an available review decision. Read the updated profile for the rider's current saved status.",
      ],
    ),
    sections: {
      ...profileSections,
      Records: guide(
        "Find riders",
        [
          "Narrow the directory",
          "Combine search with vehicle, verification, exact email or registration dates. Enter both dates or clear both; the range includes both days in Africa/Lagos.",
        ],
        [
          "Read the status carefully",
          "Online and Offline are saved statuses. Open the profile to inspect the rider, vehicle and application details.",
        ],
      ),
      "Personal information": guide(
        "Rider personal information",
        [
          "Check contact and online status",
          "Review the saved name, contact details and Online status. Online does not confirm a live connection to the rider's device.",
        ],
        [
          "Correct saved details",
          "Use Edit rider information at the top of the profile and explain the change. Email or main phone changes sign the account out; changing email also requires verification and removes linked social sign-in.",
        ],
      ),
      Verification: guide(
        "Rider verification",
        [
          "Read the account flags",
          "Review verification, Disabled and Deleted separately. Approval does not remove other account restrictions.",
        ],
        [
          "Review the application",
          "Use Inspect application and review history to check photos, requirements and available decisions. The profile's verification section does not approve the rider.",
        ],
      ),
      "Vehicle & documents": guide(
        "Vehicle and documents",
        [
          "Check the assigned vehicle",
          "Review the vehicle type and saved details. If no type is assigned, use Assign vehicle type when available.",
        ],
        [
          "Understand the review consequence",
          "Vehicle changes return the rider to pending review and take them offline. Open the application afterward to inspect the photos and complete review.",
        ],
      ),
      "Payout destination": guide(
        "Payout destination",
        [
          "Review the saved destination",
          "Super administrators can inspect the rider's masked bank details here.",
        ],
        [
          "Keep bank details separate from balances",
          "This section identifies the payout destination; it does not confirm a transfer. Check wallet and transaction records for financial activity.",
        ],
      ),
      "Masked bank details": guide(
        "Masked bank details",
        [
          "Check the account shown",
          "Use the visible bank and account details to identify the rider's saved payout destination. Sensitive account information remains masked.",
        ],
        [
          "Refresh when needed",
          "Refresh masked bank details to check the latest saved destination. This view does not change bank details or send money.",
        ],
      ),
      "Export riders": guide(
        "Export riders",
        [
          "Confirm the selection",
          "The export starts with your applied directory filters. Adjust the search, vehicle, verification, exact email or registration dates as needed.",
        ],
        [
          "Save the complete result",
          "Choose CSV or JSON and Download export. All matches arrive in one file after a successful download; an interrupted download is discarded.",
        ],
      ),
    },
  },
  {
    path: "/rider-weekly-deliveries",
    page: guide(
      "Rider weekly deliveries",
      [
        "Choose the period",
        "Enter up to 52 weeks and an optional Through date, then apply the report options. Week boundaries use Africa/Lagos.",
      ],
      [
        "Read each rider's activity",
        "Completed orders totals the weeks shown for that rider. Open Weekly breakdown to inspect the individual weeks.",
      ],
      [
        "Check coverage and more riders",
        "Read Report coverage and use the page controls to browse additional riders. The report's summary information is not limited to one page.",
      ],
    ),
    sections: {
      "Report options": guide(
        "Delivery report options",
        [
          "Set the number of weeks",
          "Enter 1–52 weeks and an optional Through date. Leave fields blank to use the report's defaults.",
        ],
        [
          "Apply the period",
          "Choose Apply report options to update the rider records. Dates and weeks use Africa/Lagos.",
        ],
      ),
      "Rider delivery records": guide(
        "Rider delivery records",
        [
          "Compare the shown weeks",
          "Completed orders adds the returned weekly counts for each rider. It is not a lifetime delivery total.",
        ],
        [
          "Inspect a weekly breakdown",
          "Expand Weekly breakdown in a rider's row, or use the page controls to view other riders.",
        ],
      ),
      "Report information": guide(
        "Rider delivery report information",
        [
          "Check the report date",
          "The report date identifies when the returned delivery results were measured.",
        ],
        [
          "Review the selected weeks",
          "Read each rider's weekly breakdown alongside this date and Report coverage.",
        ],
      ),
      "Report coverage": reportCoverage,
    },
  },
  {
    path: "/rider-applications",
    page: guide(
      "Rider applications",
      [
        "Find an application",
        "The queue starts with pending applications. Filter by application status, verification, vehicle, email or dates to find the rider you need.",
      ],
      [
        "Review the evidence",
        "Open the application to inspect the applicant, two required photos and the approval checklist. Use the rider profile link to correct personal or vehicle details.",
      ],
      [
        "Record the decision",
        "Choose an available approval or rejection action and enter a reason. Read the returned confirmation and refreshed applicant details afterward.",
      ],
    ),
    detail: guide(
      "Review a rider application",
      [
        "Inspect the applicant and photos",
        "Check the vehicle and plate-number photos alongside the applicant information. Missing or unusable photos can be replaced here.",
      ],
      [
        "Resolve checklist issues",
        "Approval is unavailable while a requirement needs attention. Correct the details or photos, then refresh the application.",
      ],
      [
        "Approve or reject with a reason",
        "Use the available decision form. Read the confirmation message and refreshed online status; do not assume approval leaves the rider offline.",
      ],
      [
        "Check the review history",
        "The history records earlier decisions and reasons in oldest-first order. A successful review refreshes both the application and its history.",
      ],
    ),
    sections: {
      "Application queue": guide(
        "Application queue",
        [
          "Choose the applications to review",
          "Start with pending applications or change the status and verification filters. Clear an exact email filter before searching by part of an email.",
        ],
        [
          "Check the date meaning",
          "The range includes both days in Africa/Lagos and uses submission date, or creation date for older applications. Open a row to review its evidence.",
        ],
      ),
      "Application review": guide(
        "Application review",
        [
          "Review the current application",
          "Check the applicant information, photos and approval checklist before choosing a decision.",
        ],
        [
          "Refresh after corrections",
          "Refresh application review after correcting profile details or evidence. Only currently available decisions can be submitted.",
        ],
      ),
      "Application information": guide(
        "Application information",
        [
          "Confirm the application",
          "Check the rider, application status and submission date so you are reviewing the intended record.",
        ],
        [
          "Read verification separately",
          "Application status and verification status describe different checks. Use the checklist and review decision sections before approving.",
        ],
      ),
      "Applicant information": guide(
        "Applicant information",
        [
          "Inspect the saved profile",
          "Review the rider's personal and vehicle details alongside the submitted photos.",
        ],
        [
          "Use the latest online status",
          "After a decision, this information refreshes from the saved application. Read the displayed status instead of inferring it from approval alone.",
        ],
      ),
      "Verification documents": guide(
        "Verification documents",
        [
          "Inspect both required photos",
          "Review the vehicle photo and plate-number photo. Use the download buttons for available evidence.",
        ],
        [
          "Replace unusable evidence",
          "Open the matching replacement form, upload a clear image and enter a reason. Linking a replacement returns the application to pending and takes the rider offline.",
        ],
      ),
      "Approval checklist": guide(
        "Approval checklist",
        [
          "Resolve items needing attention",
          "Each requirement must be ready before approval is available. Read the listed issue to decide whether a photo or profile correction is needed.",
        ],
        [
          "Correct and refresh",
          "Use the rider profile link for personal or vehicle corrections, then return and refresh the application. Operations access is required to make those corrections.",
        ],
      ),
      "Review decision": guide(
        "Review decision",
        [
          "Choose an available decision",
          "Open Approve rider or Reject application and explain your decision. Approval checks the current requirements again before saving.",
        ],
        [
          "Read the confirmation",
          "The confirmation uses the returned message and refreshes the applicant information. Older results may simply say Rider application updated, so check the refreshed status.",
        ],
      ),
      "Review history": guide(
        "Review history",
        [
          "Read previous decisions",
          "Reviews appear oldest first with their reason, reviewer and date. Use the page controls for more history.",
        ],
        [
          "Keep missing history distinct",
          "Older missing reviews are not recreated. A lack of entries is not proof that no earlier decision occurred.",
        ],
      ),
    },
  },
  {
    path: "/vendors",
    page: guide(
      "Partner applications",
      [
        "Check availability",
        "Vendor and merchant directories are not available in this release. This page does not provide an application queue or approval form.",
      ],
      [
        "Use the relevant account section",
        "Return to the sidebar for available user and rider tools. Those sections do not replace vendor application review.",
      ],
    ),
    detail: guide(
      "Partner profile",
      [
        "Understand the unavailable view",
        "Partner profile inspection is not available in this release. No editable partner record is shown here.",
      ],
      [
        "Return to available work",
        "Use the sidebar to open a supported section. Do not treat this message as a missing or rejected partner application.",
      ],
    ),
  },
  {
    path: "/shipment-orders",
    page: guide(
      "Shipment orders",
      [
        "Find a shipment",
        "Paste the full shipment ID for an exact match, or filter by origin city, shipment type and status. Other filters still apply to an ID search.",
      ],
      [
        "Inspect the shipment",
        "Open a row to review the customer, route, package, documents, pricing and rider details.",
      ],
      [
        "Use the available next action",
        "The detail page shows actions allowed at the shipment's current stage. Customer payments, rider payments and delivery progress are tracked separately.",
      ],
    ),
    detail: guide(
      "Shipment details",
      [
        "Confirm the shipment and stage",
        "Review the shipment type, current status and customer details. Check the history when you need to understand an earlier change.",
      ],
      [
        "Follow the available workflow",
        "Use the available status action and provide its requested details and evidence. For older records, Change historical status only corrects the saved stage; it does not move money.",
      ],
      [
        "Review pricing and payments",
        "Use Shipment pricing for charges or price corrections, and Customer shipment assessments for payment links or cash receipts. Rider pickup earnings are separate.",
      ],
      [
        "Confirm the outcome",
        "Read the result after saving and refresh the shipment when work is still processing. A queued payment or refund is not a completed one.",
      ],
    ),
    sections: {
      Records: guide(
        "Find shipment orders",
        [
          "Search or filter",
          "Use the full, case-sensitive shipment ID for an exact search. City means the shipment's origin; Unknown includes older records without a clear origin.",
        ],
        [
          "Open the shipment",
          "Check its type and status, then open the row. Customer amount, rider earnings and rider payment columns describe separate parts of the order.",
        ],
      ),
      "Order status": orderStatus,
      "Payment type": paymentType,
      "Total amount": totalAmount,
      "Update shipment status": guide(
        "Update shipment status",
        [
          "Choose the available next step",
          "Open the action that matches the work completed, then supply the requested details and evidence. Some shipments are available for inspection only.",
        ],
        [
          "Resolve payment or processing blocks",
          "If onward delivery is awaiting customer payment, use Go to pricing and payments. Wait for a pending assignment or assessment to finish before another change.",
        ],
        [
          "Check the result",
          "Refresh the shipment after saving or processing. Cancellation is final, and a required refund may still be pending.",
        ],
      ),
      "Shipment pricing": guide(
        "Shipment pricing",
        [
          "Choose the correct pricing action",
          "Assess shipment charge creates the initial bill when available. Review shipment price replaces the full price after reweighing or a correction.",
        ],
        [
          "Enter the full revised amount",
          "For a price review, enter the entire price in naira before discounts, the new weight and a reason. Any amount already paid is taken into account.",
        ],
        [
          "Read the pricing outcome",
          "The result explains whether further payment or a refund is needed. Use Customer shipment assessments for the payment steps.",
        ],
      ),
      "Customer shipment assessments": guide(
        "Customer shipment assessments",
        [
          "Choose the customer charge",
          "Review each bill and its payment status. A payment link is ready only when the link appears in this section.",
        ],
        [
          "Collect and confirm payment",
          "Use the available payment-link or cash-receipt action. Record a cash receipt only after receiving the stated amount and adding the requested evidence.",
        ],
        [
          "Check pending payments",
          "Refresh payment status before replacing an inactive link. A recorded cash payment cannot simply be marked unpaid again.",
        ],
      ),
      "Order information": guide(
        "Shipment information",
        [
          "Confirm the shipment type",
          "Check the shipment ID and whether this is local, international or customs clearance work. The supporting fields depend on that type.",
        ],
        [
          "Use the relevant workflow",
          "Local service and zone identify domestic delivery details. Customs clearance has its own intake and completion steps.",
        ],
      ),
      "Customer and receiver": guide(
        "Shipment customer and receiver",
        [
          "Check both contacts",
          "Review the sender and receiver details before arranging pickup or delivery. Customs clearance may not include a receiver.",
        ],
        [
          "Open the customer profile",
          "Use the customer link when available to inspect the account. A missing contact value means it was not supplied in this record.",
        ],
      ),
      Locations: guide(
        "Shipment locations",
        [
          "Read the full route",
          "Compare the pickup, drop-off and PND office addresses. International shipments may also show country and postal code.",
        ],
        [
          "Check before dispatch",
          "Use these saved addresses to confirm the intended route. Live tracking, when available, is shown separately.",
        ],
      ),
      "Package and documents": guide(
        "Package and documents",
        [
          "Inspect the package details",
          "Review item types, declared value, weight in kilograms and dimensions in centimetres.",
        ],
        [
          "Download available documents",
          "Use the named download buttons to inspect attached files. If no documents are shown, there are no downloadable documents in this record.",
        ],
      ),
      "Clearance documents": guide(
        "Clearance documents",
        [
          "Inspect attached evidence",
          "Use the document download buttons to review the files saved with this customs-clearance shipment.",
        ],
        [
          "Complete clearance separately",
          "Document inspection does not complete clearance. Use the available clearance action and provide the required completion evidence.",
        ],
      ),
      "Payment information": guide(
        "Shipment payment information",
        [
          "Review the customer payment",
          "Compare gross amount, discount, total and available payment details. This section concerns the customer's shipment charge.",
        ],
        [
          "Check refunds separately",
          "Read any refund details returned with the shipment. Cancellation does not by itself confirm a completed refund.",
        ],
      ),
      "Rider pickup earnings and payment": guide(
        "Rider pickup earnings and payment",
        [
          "Review the rider's payment",
          "Read the pickup earnings, payment method, payment status and confirmation time when available.",
        ],
        [
          "Keep the three statuses separate",
          "Rider payment, customer shipment payment and parcel delivery progress are different records. One does not confirm the others.",
        ],
      ),
      "Rider and vehicle": guide(
        "Shipment rider and vehicle",
        [
          "Confirm the assigned rider",
          "Review the rider's name, phone, photo and vehicle details. No assignment is shown when no rider has been assigned.",
        ],
        [
          "Inspect the rider profile",
          "Open the rider link when available for more account and vehicle information. Assignment changes belong in Update shipment status.",
        ],
      ),
      Dates: orderDates,
      "Shipment status history": guide(
        "Shipment status history",
        [
          "Read recorded changes",
          "Review each status change with its action, time, actor, reason and evidence when available.",
        ],
        [
          "Browse older records",
          "Use the page controls to inspect more events. Older entries may have no recorded actor or reason.",
        ],
      ),
      "Live tracking": guide(
        "Live tracking",
        [
          "Check pickup progress",
          "Tracking is available during supported active pickup stages. A missing location means no live location is available right now.",
        ],
        [
          "Use the order for final status",
          "Location information does not confirm delivery or payment. Check the shipment's current status and history separately.",
        ],
      ),
    },
  },
  {
    path: "/ride-hailing",
    page: guide(
      "Ride hailing and courier",
      [
        "Find the order",
        "Paste the full ride ID for an exact, case-sensitive match, or filter by origin city and status. Other filters still apply to an ID search.",
      ],
      [
        "Review the ride details",
        "Open the record to inspect the customer, assigned rider, route, payment and dates. Older records may have incomplete information.",
      ],
      [
        "Check available changes",
        "Super administrators see cancellation or historical status controls when the order allows them. Read the consequences before saving.",
      ],
    ),
    detail: guide(
      "Ride details",
      [
        "Confirm the order",
        "Review the service, current status, customer, rider and route. Data availability identifies missing details on older rides.",
      ],
      [
        "Check payment information",
        "Read the recorded price and payment details. Cancelled and expired rides hide payment-status summaries; that does not confirm a refund.",
      ],
      [
        "Read cancellation consequences",
        "When Cancel ride is available, read its explanation and enter a reason. Wallet refunds and rider earnings depend on whether a rider was assigned; cash payments remain for review.",
      ],
      [
        "Correct an older record",
        "If Change historical status is available, it updates the saved stage only. It does not charge the customer, pay the rider or issue a refund.",
      ],
    ),
    sections: {
      Records: guide(
        "Find rides and courier orders",
        [
          "Use the full order ID",
          "An ID search matches exactly and respects the city and status filters. Origin city describes where the order started.",
        ],
        [
          "Inspect the selected record",
          "Open a row for its rider, route and payment details. Data quality and unavailable fields indicate gaps in older records.",
        ],
      ),
      "Order details": guide(
        "Ride order details",
        [
          "Review the current ride",
          "Read the status and the customer, rider, location and payment sections before taking action.",
        ],
        [
          "Refresh after a change",
          "Refresh order details to check the latest saved result. Only actions currently available for your role and this ride are shown.",
        ],
      ),
      "Order status": orderStatus,
      "Payment type": paymentType,
      "Total amount": totalAmount,
      "Data availability": guide(
        "Ride data availability",
        [
          "Read the missing fields",
          "This notice identifies information that was not retained for an older ride. Other available details remain visible below.",
        ],
        [
          "Keep unknown values separate",
          "Do not treat missing amounts as zero or missing assignment details as proof that no rider was assigned.",
        ],
      ),
      "Cancellation reason": guide(
        "Cancellation reason",
        [
          "Read the saved explanation",
          "This is the reason recorded when the ride was cancelled.",
        ],
        [
          "Check the financial outcome",
          "The reason does not confirm a refund or rider payment. Review the available payment details and related transactions separately.",
        ],
      ),
      "Order information": guide(
        "Ride information",
        [
          "Identify the service",
          "Check the order ID, service, ride type, status and vehicle type to confirm which ride or courier job you are reviewing.",
        ],
        [
          "Follow the supporting sections",
          "Use the customer, rider and location sections to inspect the people and route associated with this order.",
        ],
      ),
      "Customer and receiver": guide(
        "Ride customer and receiver",
        [
          "Identify the customer",
          "Review the customer account and any receiver details returned for this order.",
        ],
        [
          "Inspect the related account",
          "Open the customer link when available for profile information. Missing receiver details do not identify an alternative contact.",
        ],
      ),
      "Rider and vehicle": guide(
        "Ride rider and vehicle",
        [
          "Check the assignment",
          "Review the assigned rider's name, phone and vehicle when available.",
        ],
        [
          "Distinguish no rider from missing data",
          "No rider assigned is different from assignment information unavailable. Read the displayed notice before taking action.",
        ],
      ),
      Locations: guide(
        "Ride locations",
        [
          "Check pickup and destination",
          "Read the saved pickup and drop-off addresses to confirm the intended journey.",
        ],
        [
          "Treat estimates as estimates",
          "Distance and duration describe the estimates returned for the order, not a live journey measurement.",
        ],
      ),
      "Payment information": guide(
        "Ride payment information",
        [
          "Review the price breakdown",
          "Compare gross amount, discount, total, currency and any tip or transaction reference shown.",
        ],
        [
          "Check the order state",
          "Cancelled and expired rides omit payment status and method here. Review the related transaction before concluding that a payment was refunded.",
        ],
      ),
      "Status history": guide(
        "Ride status history",
        [
          "Review recorded progress",
          "Read the available history to understand changes in the ride's status.",
        ],
        [
          "Compare with the current status",
          "The history supports the current order record. Missing historical details are not reconstructed here.",
        ],
      ),
      Dates: orderDates,
    },
  },
  {
    path: "/support-tickets",
    page: guide(
      "Support tickets",
      [
        "Inspect a ticket",
        "Open a row to see Ticket details beside the queue. Close details returns to the queue without clearing its filters or page.",
      ],
      [
        "Claim and open the conversation",
        "Claim the ticket to work on it, or use Open conversation to read the thread. Replies require an open ticket assigned to you.",
      ],
      [
        "Find closed work",
        "Only super administrators can view closed tickets or reopen them. They can also open Closure history to inspect saved resolutions.",
      ],
    ),
    detail: guide(
      "Support conversation",
      [
        "Read the conversation in order",
        "Messages run from oldest to newest; Load older messages adds earlier history. New messages refresh automatically while the page is visible.",
      ],
      [
        "Claim before replying",
        "Claim an open ticket before replying; attachments require assignment unless you are a super administrator. Use Refresh conversation to check for new messages.",
      ],
      [
        "Close with a useful summary",
        "Choose Close ticket and describe the issue and how you handled it. Closing sends the customer a closing message and saves your summary.",
      ],
      [
        "Reopen when appropriate",
        "Only a super administrator can view and reopen a closed ticket. Reopening keeps earlier closure records.",
      ],
    ),
    sections: {
      Records: guide(
        "Support queue",
        [
          "Find the conversation",
          "Use the latest message, unread count and update time to decide which ticket to inspect. Open a row to show its details beside the queue.",
        ],
        [
          "Continue from the details",
          "Claim the ticket when you need to work on it, then open the conversation. Closed-ticket filters are available only to super administrators.",
        ],
      ),
      "Ticket details": guide(
        "Ticket details",
        [
          "Identify the customer and owner",
          "Check the customer's details, ticket status and assigned staff member before joining the conversation.",
        ],
        [
          "Open the working conversation",
          "Use Open conversation for the full thread. Claim an open ticket to reply; super administrators can inspect attachments without claiming.",
        ],
      ),
      "Saved closure": guide(
        "Saved closure",
        [
          "Confirm the resolution was saved",
          "Review the saved closure information after closing the ticket.",
        ],
        [
          "Inspect earlier closures",
          "Super administrators can use View closure history to see previous resolutions. Reopening a ticket does not remove them.",
        ],
      ),
    },
  },
  {
    path: "/support-closures",
    page: guide(
      "Support closure history",
      [
        "Find the resolution",
        "Super administrators can filter by Ticket ID or the staff member who closed it. The newest closures appear first.",
      ],
      [
        "Read the saved summary",
        "Review the resolution, staff member and closure date. No summary recorded means that an older closure has no saved explanation.",
      ],
      [
        "Open the conversation",
        "Follow the ticket link to inspect the conversation. Reopening the ticket keeps these earlier closure records.",
      ],
    ),
    sections: {
      Records: guide(
        "Saved support closures",
        [
          "Narrow the history",
          "Filter by a ticket or closing staff member, then use the page controls to inspect more records. Newest closures appear first.",
        ],
        [
          "Review the outcome",
          "Read the summary, closing staff member and date. Open the ticket link for conversation context; previous closures remain after reopening.",
        ],
      ),
    },
  },
];
