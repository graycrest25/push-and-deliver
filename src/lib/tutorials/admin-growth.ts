import type { FeatureHelp } from "./types";

const rewardCampaigns: FeatureHelp["page"] = {
  title: "Reward campaigns",
  steps: [
    {
      title: "Create a discount template",
      description:
        "Set a whole-number discount from 1% to 100%, choose 24 or 48 hours, and select the services where the coupon can be used.",
    },
    {
      title: "Choose how the campaign is used",
      description:
        "Campaign active controls availability. Eligible for game rewards lets the game use it. Both must be on for a game reward; enabling the game alone does not create rewards.",
    },
    {
      title: "Check the saved campaign",
      description:
        "Use the row controls to enable, disable or change game eligibility. The list shows saved settings, not how many rewards are available right now.",
    },
  ],
};

const gameSections: NonNullable<FeatureHelp["sections"]> = {
  "Game availability": {
    title: "Game availability",
    steps: [
      {
        title: "Choose whether players can start",
        description:
          "Turn Enable new attempts on to allow new games, or off to pause them. Attempts already started keep their original rules and reserved rewards.",
      },
      {
        title: "Choose the level for new games",
        description:
          "Global active level selects Easy, Medium or Hard for new attempts. Review that level’s timing, then use Save game rules to apply the change.",
      },
    ],
  },
  "Reward limits": {
    title: "Reward limits",
    steps: [
      {
        title: "Set both daily limits",
        description:
          "Set the total daily reward cap across all players, then the maximum per player. Reward days follow UTC, as shown beside the fields.",
      },
      {
        title: "Keep existing rewards in mind",
        description:
          "Changing these limits does not reset rewards already reserved or issued. Save game rules when the limits are ready.",
      },
    ],
  },
  "Level timing": {
    title: "Level timing",
    steps: [
      {
        title: "Adjust speed and allowed timing error",
        description:
          "Speed multiplier changes how quickly the game timer runs. Tolerance sets how early or late a player can stop and still qualify. Review the real-time target shown beneath each level.",
      },
      {
        title: "Try a preset without saving it",
        description:
          "Apply preset to draft changes the selected level and timing values. It leaves availability and reward limits unchanged. Check Timing preview before saving.",
      },
    ],
  },
  "Timing preview": {
    title: "Timing preview",
    steps: [
      {
        title: "Read the target and window",
        description:
          "The preview shows the approximate real time a player has to stop the timer for the selected level. A larger tolerance gives a wider window.",
      },
      {
        title: "Check the expiry warning",
        description:
          "Attempts expire after two minutes. A timing window beyond that may make the level unwinnable. Previewing does not start a game or use an attempt.",
      },
    ],
  },
  "Reward campaigns": rewardCampaigns,
};

const signupCoupons: FeatureHelp["page"] = {
  title: "Signup coupon settings",
  steps: [
    {
      title: "Choose the signup campaigns",
      description:
        "Copy campaign IDs from Campaigns and enter the enabled 24- or 48-hour campaigns to issue at signup. Separate multiple IDs with commas.",
    },
    {
      title: "Review the selection before saving",
      description:
        "Choose at least one campaign before turning on signup coupons. Saving uses your selected campaigns, even if signup previously used all eligible campaigns.",
    },
  ],
};

const signupWallet: FeatureHelp["page"] = {
  title: "Signup wallet bonus",
  steps: [
    {
      title: "Set the bonus for new signups",
      description:
        "Choose whether to credit new signups and enter the amount per signup in naira. This setting does not let you credit an individual wallet.",
    },
    {
      title: "Enter the new total budget",
      description:
        "The budget replaces the total promotional allowance; it is not an amount to add. It includes bonuses already credited and cannot be lower than the amount already spent.",
    },
    {
      title: "Review pending bonuses",
      description:
        "Turning off new bonuses does not stop bonuses already waiting to be processed. They may still use the remaining allowance. Save when both the amount and total budget are correct.",
    },
  ],
};

const accountRole: FeatureHelp["page"] = {
  title: "Account role",
  steps: [
    {
      title: "Check whose access you are changing",
      description:
        "Confirm the selected account and its current role. Only existing accounts with verified email and enabled access can be promoted.",
    },
    {
      title: "Choose the role and explain why",
      description:
        "Select Super, Regular, Customer care or Verifier. Choose none to remove administrator access. Add a reason before saving.",
    },
    {
      title: "Allow for sign-out",
      description:
        "Changing a role signs that account out of its existing sessions. Review changes carefully, especially when editing your own access.",
    },
  ],
};

export const adminGrowthHelp: FeatureHelp[] = [
  {
    path: "/game-rules",
    page: {
      title: "Ten Seconds",
      steps: [
        {
          title: "Set up the next game",
          description:
            "Super admins can choose game availability, the active level, timing and reward limits. If rules have not been set up, select Set up game rules first.",
        },
        {
          title: "Preview before saving",
          description:
            "Check the real-time target and allowed window. Edits and presets stay in your draft until you select Save game rules. Games already started keep their original settings.",
        },
        {
          title: "Prepare reward campaigns",
          description:
            "Open Reward campaigns to create or enable suitable coupons. A campaign must be active and eligible for game rewards. Turning on the game does not guarantee rewards are available.",
        },
        {
          title: "Resolve a save that needs attention",
          description:
            "If saving is interrupted, use Retry pending save. If another admin changed the rules, review the latest settings before saving your draft again.",
        },
      ],
    },
    sections: gameSections,
  },
  {
    path: "/app-config",
    page: {
      title: "App configuration",
      steps: [
        {
          title: "Choose the setting you need",
          description:
            "Super admins use Dispatch for the rider search radius, Mobile releases for app versions, Signup bonuses for wallet rewards, and Game rules for Ten Seconds.",
        },
        {
          title: "Review the effect before saving",
          description:
            "Each tab saves its own settings. For mobile releases, check the app and platform first. For signup bonuses, enter the total budget you want, not an amount to add.",
        },
        {
          title: "Check the result",
          description:
            "Wait for the saved settings to reload. If the page says another admin made a change, review the updated values before saving again.",
        },
      ],
    },
    sections: {
      ...gameSections,
      "Dispatch radius": {
        title: "Dispatch radius",
        steps: [
          {
            title: "Choose the distance from pickup",
            description:
              "Enter a radius from 0.1 to 20 km. Ride and courier requests normally use 5 km. This distance affects which riders receive offers and can see or accept the order.",
          },
          {
            title: "Save the radius",
            description:
              "Select Save dispatch radius and check the saved value. If another admin changed it first, review the current radius before trying again.",
          },
        ],
      },
      "Release settings": {
        title: "Release settings",
        steps: [
          {
            title: "Choose the app and platform",
            description:
              "Select the user or rider app, then Android or iOS. Changes apply only to that selection.",
          },
          {
            title: "Review versions and availability",
            description:
              "Enter the latest version, the oldest supported version and the official store link. Include a message when turning on maintenance. Food and ecommerce remain disabled.",
          },
          {
            title: "Publish and check",
            description:
              "Select Publish release settings, then check the public release policy. Enabling an app feature here announces availability; it does not set up the service itself.",
          },
        ],
      },
      "Signup wallet bonus": signupWallet,
    },
  },
  {
    path: "/coupons",
    page: {
      title: "Coupons & signup rewards",
      steps: [
        {
          title: "Prepare a campaign",
          description:
            "Campaigns define the discount, eligible services and 24- or 48-hour validity. Create a campaign or check that an existing one is active.",
        },
        {
          title: "Generate a customer code",
          description:
            "In Generate code, enter the customer’s user ID and the campaign ID. Copy the generated code for the customer; creating it does not confirm they received it.",
        },
        {
          title: "Manage signup rewards",
          description:
            "Signup coupons chooses the campaigns issued to new users. Processing shows issuance work and errors. Only jobs marked dead can be requeued after review.",
        },
      ],
    },
    sections: {
      "Reward campaigns": rewardCampaigns,
      "Signup coupon settings": signupCoupons,
      Records: {
        title: "Signup coupon processing",
        steps: [
          {
            title: "Find work that needs attention",
            description:
              "Filter by status, then check the customer, task, attempt count and last error. Pending or processing work may still complete.",
          },
          {
            title: "Retry only a stopped job",
            description:
              "Requeue job is available only for jobs marked dead. Review the error and enter a reason. Requeueing keeps the customer’s original signup reward and its processing history.",
          },
        ],
      },
    },
  },
  {
    path: "/coupon-redemption-metrics",
    page: {
      title: "Coupon redemption metrics",
      steps: [
        {
          title: "Choose when the coupons were issued",
          description:
            "Set Issuance start and Issuance end, then apply the report options. This selects coupons by when they were issued, rather than when they were used.",
        },
        {
          title: "Choose the measurement date",
          description:
            "Measured as of is optional. Use it when you need to compare results at a specific date. Dates follow Africa/Lagos.",
        },
        {
          title: "Check completeness before comparing",
          description:
            "Review the issuance period and Report coverage with the results. Missing information means the result is incomplete, not that no coupons were used.",
        },
      ],
    },
    sections: {
      "Report options": {
        title: "Report options",
        steps: [
          {
            title: "Set the issuance period",
            description:
              "Choose both issuance dates to select the coupons you want to measure. Add Measured as of if you need a particular measurement date.",
          },
          {
            title: "Apply your selection",
            description:
              "Select Apply report options to load the results. Changing a date field alone does not update the report.",
          },
        ],
      },
      "Report information": {
        title: "Report information",
        steps: [
          {
            title: "Confirm the report dates",
            description:
              "Check the period and measurement date shown with the returned totals before comparing them with another report.",
          },
          {
            title: "Read missing values carefully",
            description:
              "An unavailable value is not zero. Check Report coverage if the totals appear incomplete.",
          },
        ],
      },
      "Issuance period": {
        title: "Issuance period",
        steps: [
          {
            title: "Check which coupons are included",
            description:
              "This section describes the coupons issued during your chosen dates. It helps you confirm that you are comparing the same group of coupons.",
          },
          {
            title: "Change the group in Report options",
            description:
              "To measure coupons issued in another period, change the issuance dates and apply the options again.",
          },
        ],
      },
      "Report coverage": {
        title: "Report coverage",
        steps: [
          {
            title: "Check whether the evidence is complete",
            description:
              "Read any missing periods or incomplete data notes before relying on the redemption totals.",
          },
          {
            title: "Keep gaps visible",
            description:
              "Mention any coverage gaps when sharing the report. Refresh after the missing information has been restored; do not treat gaps as zero activity.",
          },
        ],
      },
    },
  },
  {
    path: "/referrals",
    page: {
      title: "Referrals",
      steps: [
        {
          title: "Choose who made the referral",
          description:
            "User Referrals and Rider Referrals refer to the person who shared the code, not the person who registered. Choose All to include both.",
        },
        {
          title: "Apply dates and inspect records",
          description:
            "Choose both dates and select Apply dates. Both days are included in Africa/Lagos time. Use the list’s user ID or referral-code filters to narrow the records further.",
        },
        {
          title: "Check the export scope",
          description:
            "Download filtered CSV uses the selected referral tab, applied dates and optional export referral code. The filters inside the records list do not change the CSV.",
        },
      ],
    },
    detail: {
      title: "Referral details",
      steps: [
        {
          title: "Return to the referral list",
          description:
            "Individual referral details are not available on this page. Use Referrals to find the record and open the linked user or rider account.",
        },
        {
          title: "Use the list or export",
          description:
            "Check who referred the user, the code used and the recorded date in the list. Use the CSV when you need to review several referrals together.",
        },
      ],
    },
    sections: {
      "Global referral totals · all dates and referrers": {
        title: "Global referral totals",
        steps: [
          {
            title: "Read these as overall totals",
            description:
              "These totals cover all dates and referrers. Choosing a referral tab, applying dates or filtering the list does not change them.",
          },
          {
            title: "Use records for a narrower view",
            description:
              "Use the list and export below to investigate a period or referral code. Compare the overall totals only with another overall report.",
          },
        ],
      },
      Records: {
        title: "Referral records",
        steps: [
          {
            title: "Trace the referral",
            description:
              "Read the referred and referrer emails alongside the code used. Select an email to open that person’s account when a link is available.",
          },
          {
            title: "Narrow the list",
            description:
              "Filter by the referred user ID or referral code. These list filters do not affect Download filtered CSV; use the separate export code field for that file.",
          },
        ],
      },
    },
  },
  {
    path: "/promoter-links",
    page: {
      title: "Promoter referral links",
      steps: [
        {
          title: "Create or renew a named link",
          description:
            "Open Create or renew and enter the promoter name using letters and digits only, without spaces. Successful activation lasts 30 days; check the returned expiry.",
        },
        {
          title: "Share the returned code and link",
          description:
            "Copy the code and Share URL shown after saving or in Promoter links. If the link is still pending, check its status again before sharing it.",
        },
        {
          title: "Manage availability and review referrals",
          description:
            "Enable or disable a link from its row. This keeps its existing count and expiry. View referral attribution shows recorded referrals; these links do not set commissions or payments.",
        },
      ],
    },
    sections: {
      "Promoter links": {
        title: "Promoter links",
        steps: [
          {
            title: "Check the link before sharing",
            description:
              "Review availability and expiry, then copy the returned code or Share URL. Use the saved values instead of building a link yourself.",
          },
          {
            title: "Change availability without renewing",
            description:
              "Enable or disable changes whether the link is available. It keeps the existing referral count and expiry. Use Create or renew when the link needs renewal.",
          },
        ],
      },
    },
  },
  {
    path: "/general-notifications",
    page: {
      title: "Broadcast notifications",
      steps: [
        {
          title: "Choose the audience and message",
          description:
            "Choose Riders, Customers or All accounts. Review the title and message carefully, then select Queue broadcast.",
        },
        {
          title: "Check progress after queuing",
          description:
            "Queued means the announcement was accepted for processing. Open View broadcast progress or a history entry to follow it; queuing does not confirm delivery to every phone.",
        },
        {
          title: "Retry the same submission when needed",
          description:
            "If the request is interrupted, retry the unchanged message. Creating another broadcast or using resend can send the announcement again.",
        },
      ],
    },
    detail: {
      title: "Broadcast details",
      steps: [
        {
          title: "Confirm the saved announcement",
          description:
            "Check the title, message, audience and expiry. Progress refreshes while the broadcast is queued, processing or retrying.",
        },
        {
          title: "Read the counts correctly",
          description:
            "Processed includes skipped accounts. Push-provider acceptance means the push service accepted a submission, not that a person received or opened it.",
        },
        {
          title: "Resend only when another announcement is intended",
          description:
            "Confirm resend creates a new broadcast with the saved message and audience. People who received the earlier broadcast may receive it again.",
        },
      ],
    },
    sections: {
      Records: {
        title: "Broadcast history",
        steps: [
          {
            title: "Open an announcement",
            description:
              "History shows the newest broadcasts first. Select a title to read the complete saved message and its current progress.",
          },
          {
            title: "Distinguish processing from delivery",
            description:
              "Processed includes skipped accounts. Accepted by push provider does not prove that a phone displayed the message or that someone opened it.",
          },
        ],
      },
      "Saved content": {
        title: "Saved content",
        steps: [
          {
            title: "Confirm what was sent for processing",
            description:
              "Review the saved title, message and audience, plus who created the broadcast and when it expires.",
          },
          {
            title: "Check whether this is a resend",
            description:
              "A Resent from link opens the earlier broadcast. Resending uses the saved message and can include people who received it before.",
          },
        ],
      },
      Recipients: {
        title: "Recipients",
        steps: [
          {
            title: "Follow recipient processing",
            description:
              "Pending, Processing and Waiting to retry show work still underway. Totals can grow while the app finds eligible accounts.",
          },
          {
            title: "Read processed and failed counts",
            description:
              "Processed includes accounts that were skipped. Failed records need attention; neither count confirms whether a person opened the announcement.",
          },
        ],
      },
      "Recipient discovery": {
        title: "Recipient discovery",
        steps: [
          {
            title: "Check whether recipients are still being found",
            description:
              "These counts describe work to find eligible accounts, not the number of people receiving the announcement.",
          },
          {
            title: "Wait for the recipient list to finish growing",
            description:
              "Recipient totals may increase while discovery continues. Use the Recipients section for the account counts.",
          },
        ],
      },
      "Push-provider acceptance": {
        title: "Push-provider acceptance",
        steps: [
          {
            title: "Distinguish accounts from devices",
            description:
              "One account can use several devices, so accepted device submissions may exceed accepted recipients.",
          },
          {
            title: "Treat acceptance as one step",
            description:
              "The push service accepting a submission does not confirm delivery or opening. Older broadcasts may not have these counts; unavailable is not zero.",
          },
        ],
      },
    },
  },
  {
    path: "/admin/users",
    page: {
      title: "Administrator access",
      steps: [
        {
          title: "Find the account",
          description:
            "Super admins can search all user accounts, current administrators or non-admin users. Clear the exact email filter before searching by part of a name or email.",
        },
        {
          title: "Open and review access",
          description:
            "Select the account to load Account role. Check the person’s details and current role before choosing a new one. Choose none to remove administrator access.",
        },
        {
          title: "Explain and save the change",
          description:
            "Enter a reason. A role change signs that account out of existing sessions. Only accounts with verified email and enabled access can be promoted.",
        },
      ],
    },
    sections: {
      "Account role": accountRole,
      "Select an account": {
        title: "Select an account",
        steps: [
          {
            title: "Find the right person",
            description:
              "Search by name or partial email, or use the exact Email address filter. Check the name and user ID before selecting a result.",
          },
          {
            title: "Review access above the list",
            description:
              "Selecting a result opens Account role. Finding an account here does not grant it administrator access; changes require a separate save and reason.",
          },
        ],
      },
      Administrators: {
        title: "Administrators",
        steps: [
          {
            title: "Narrow the administrator list",
            description:
              "Use Administrator subtype to find a particular role. You can also search by name or email.",
          },
          {
            title: "Open a role before changing it",
            description:
              "Select the account to review its current access in Account role. A saved role change signs that account out of existing sessions.",
          },
        ],
      },
    },
  },
  {
    path: "/settings",
    page: {
      title: "Account security",
      steps: [
        {
          title: "Choose whether to sign out everywhere",
          description:
            "Sign out all sessions ends your sessions on every device, including this browser. Save any work you want to keep before continuing.",
        },
        {
          title: "Sign in again when needed",
          description:
            "After confirming, you return to sign-in. This action ends sessions; it does not change your password.",
        },
      ],
    },
  },
  {
    path: "/jobs",
    page: {
      title: "Background jobs",
      steps: [
        {
          title: "Find work that needs attention",
          description:
            "Filter by status or job type. Open a job to review its attempts and errors before deciding what to do.",
        },
        {
          title: "Distinguish waiting from stopped work",
          description:
            "Pending, processing or waiting-to-retry work may still finish. Replay is available only for a job marked dead.",
        },
        {
          title: "Review before replaying",
          description:
            "Check why the job stopped, address the cause where possible and enter a reason. Replay queues another attempt; it does not confirm the work has finished.",
        },
      ],
    },
    detail: {
      title: "Background job",
      steps: [
        {
          title: "Read the latest attempt",
          description:
            "Check the job status, attempt count and recorded errors. Use More attempts and Previous attempts to review its processing history.",
        },
        {
          title: "Replay a stopped job after review",
          description:
            "For a job marked dead, open Replay dead job and enter a reason. The app checks that you are retrying the job you reviewed.",
        },
        {
          title: "Check what happened next",
          description:
            "Refresh after replaying to follow the next attempt. A replay request puts work back in the queue; it does not mean the job succeeded.",
        },
      ],
    },
    sections: {
      Records: {
        title: "Background job records",
        steps: [
          {
            title: "Filter the work list",
            description:
              "Choose a status or job type, then open a matching job. Attempts and updated time help you identify work that needs review.",
          },
          {
            title: "Check the detail before retrying",
            description:
              "Read the job’s error history before replaying it. Work that is still processing or waiting to retry should not be started again from another record.",
          },
        ],
      },
    },
  },
  {
    path: "/files",
    page: {
      title: "Files",
      steps: [
        {
          title: "Choose a purpose and file",
          description:
            "Select File purpose, then choose the files to upload. Follow the file-type and size guidance shown for that purpose.",
        },
        {
          title: "Wait until each file is ready",
          description:
            "An upload must finish its checks before it can be used. Follow the retry prompt if processing fails. Download becomes available for ready files.",
        },
        {
          title: "Use the correct record for attachments",
          description:
            "Files uploaded here belong to your signed-in account. Use the upload controls in the relevant shipment or application when attaching evidence for that record.",
        },
      ],
    },
  },
  {
    path: "/audit",
    page: {
      title: "Audit history",
      steps: [
        {
          title: "Trace an administrator action",
          description:
            "Review the actor, affected account, action and recorded time. This page is for reading history; it does not change or undo the action.",
        },
        {
          title: "Check the source and time",
          description:
            "Records cover dashboard and role-management activity. They are not guaranteed to appear newest first, so use the recorded time when following an event.",
        },
        {
          title: "Use the relevant feature for more history",
          description:
            "Other parts of the app keep separate histories. For example, use Pricing audit for price changes and a rider application’s review history for approval decisions.",
        },
      ],
    },
    sections: {
      Records: {
        title: "Audit records",
        steps: [
          {
            title: "Connect the person, action and account",
            description:
              "The actor identifies who performed the action; the target identifies the affected account. Check the action and recorded time together.",
          },
          {
            title: "Keep the record’s scope in mind",
            description:
              "This list covers dashboard and role-management events. If the event you need belongs to another feature, check that feature’s own history.",
          },
        ],
      },
    },
  },
];
