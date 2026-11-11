import type { FeatureHelp } from "./types";

const guide = (
  title: string,
  ...steps: [title: string, description: string][]
): FeatureHelp["page"] => ({
  title,
  steps: steps.map(([stepTitle, description]) => ({
    title: stepTitle,
    description,
  })),
});

const internationalPrices = guide(
  "International prices",
  [
    "Choose a destination",
    "Search by country name or code, then choose a destination to see its weight tiers and prices.",
  ],
  [
    "Check the shared zone",
    "Countries in the same zone share prices. Editing one tier changes that tier for every country in the zone.",
  ],
  [
    "Edit a draft",
    "Use Edit price on a draft and enter the new price in naira. For an active or retired tariff, clone it as a new draft first.",
  ],
);

const countryZones = guide(
  "Country zones",
  [
    "Find the country",
    "Search for a country to see its price zone and availability. Open its prices to review the weight tiers.",
  ],
  [
    "Change a draft mapping",
    "In Edit & publish, open Add or update country mappings and choose the country and zone. Publish the draft after reviewing the changes.",
  ],
);

const tariffInformation = guide(
  "Tariff information",
  [
    "Check this tariff",
    "Review its status, service, dates and other saved details here.",
  ],
  [
    "Change draft settings",
    "Open Edit & publish, then Tariff details to change the available settings. Active and retired tariffs must be copied to a draft first.",
  ],
);

const publishTariff = guide(
  "Publish changes",
  [
    "Review the saved prices",
    "Check the Prices tab and any country mappings. Resolve any missing weight bands or destinations listed on the page.",
  ],
  [
    "Publish when ready",
    "Open Publish reviewed tariff and give a reason. Publishing activates this draft and retires the previous tariff; accepted shipments and unexpired quotes keep their prices.",
  ],
);

const publishDeliveryTariff = guide(
  "Publish changes",
  [
    "Review the saved prices",
    "Check the Prices tab and confirm the delivery service and zone. Add any missing weight bands listed on the page.",
  ],
  [
    "Publish when ready",
    "Open Publish reviewed tariff and give a reason. Publishing activates this draft and retires the previous tariff; accepted shipments and unexpired quotes keep their prices.",
  ],
);

const priceEditing = guide(
  "Edit prices",
  [
    "Enter the changed rows",
    "Add each weight and price you want to change. Saving updates only those rows; other weight bands stay unchanged.",
  ],
  [
    "Save the draft",
    "Enter prices in naira and give a reason, then choose Save prices. Review the saved prices before publishing.",
  ],
  [
    "Handle an unclear result",
    "If a save times out, retry with the same details. If the tariff changed, refresh it and review your changes before saving again.",
  ],
);

const domesticPrices = guide(
  "Weight bands & prices",
  [
    "Read the price table",
    "Weights are shown in kilograms. Prices are shown in naira (₦), with two decimal places.",
  ],
  [
    "Change a weight band",
    "Open Edit & publish and enter a weight from 0.5 to 70 kg, with up to three decimal places. Enter its price in naira.",
  ],
  [
    "Keep the other bands",
    "Save prices changes only the rows you enter. Use Delete weight bands to remove selected rows from a draft.",
  ],
);

const shippingTariff = guide(
  "Shipping tariff",
  [
    "Review the destination",
    "Use Prices to choose a country and check its weight tiers. Country zones shows which destinations share each price zone.",
  ],
  [
    "Prepare your changes",
    "Edit a draft, or clone an active or retired tariff as a new draft. Enter prices in naira and save only the rows you want to change.",
  ],
  [
    "Publish the reviewed draft",
    "Review prices and country mappings, then use Publish reviewed tariff in Edit & publish. Saving a draft alone does not activate its prices.",
  ],
);

const deliveryTariff = guide(
  "Delivery tariff",
  [
    "Review the service and zone",
    "Check the service, delivery zone and current weight bands before making changes.",
  ],
  [
    "Edit draft prices",
    "Use weights from 0.5 to 70 kg, with up to three decimal places, and enter prices in naira. Saving changes only the rows you enter.",
  ],
  [
    "Make the prices active",
    "Review the Prices tab, then publish the draft from Edit & publish. Clone an active or retired tariff before editing it.",
  ],
);

const pdfPrices = guide(
  "Upload price-list PDF",
  [
    "Open the supported tariff",
    "PDF upload is available on the active DHL export non-document tariff. Use a selectable-text PDF within the 2 MiB limit and follow PDF template requirements.",
  ],
  [
    "Preview the file",
    "Choose the PDF, enter a price-list name and reason, then choose Preview. Previewing does not change live prices.",
  ],
  [
    "Review every change",
    "Check the imported prices and country-zone changes. Higher-weight prices and country mappings not listed in the PDF are kept.",
  ],
  [
    "Publish the reviewed prices",
    "Choose Publish prices to activate the replacement tariff. If the result is unclear, retry with the same file and details.",
  ],
);

const countryPolicy = guide(
  "Country policy",
  [
    "Check booking availability",
    "Available for new bookings controls whether this destination can be used for new bookings.",
  ],
  [
    "Set the address requirement",
    "Choose whether a postal code is required, give a reason and save. Change price-zone mappings in the tariff's Edit & publish tab.",
  ],
);

const countryList = guide(
  "Shipping countries",
  [
    "Review destinations",
    "Check each country's name, booking availability and postal-code requirement. Open a country to change these settings.",
  ],
  [
    "Find its prices",
    "Open a shipping tariff to review a country's price zone and weight tiers. Country settings do not change tariff prices.",
  ],
);

const localTypes = guide(
  "Local shipping types",
  [
    "Review delivery services",
    "Check each service's name, delivery details and active status. Open a service to edit its details.",
  ],
  [
    "Prepare a new service",
    "Fill in the service's ID, name and delivery details. New services start inactive.",
  ],
  [
    "Activate after pricing",
    "Publish the service's zone tariffs before turning Active on in its details.",
  ],
);

const localTypeDetails = guide(
  "Type details",
  [
    "Edit the service",
    "Open Save local shipping type to update this service's name and delivery details.",
  ],
  [
    "Check pricing before activation",
    "Publish the service's zone tariffs before turning Active on. Give a reason and save your changes.",
  ],
);

const stateList = guide(
  "States and zones",
  [
    "Find the state",
    "Review each state's current local zone. Open the state whose zone you need to change.",
  ],
  [
    "Check its delivery coverage",
    "Use the state's details to choose the correct zone. Review that zone's prices in the Tariffs tab.",
  ],
);

const stateMapping = guide(
  "State mapping",
  ["Check the current zone", "Review the state and its saved local zone."],
  [
    "Choose the correct zone",
    "Open Save state zone, choose a local zone and give a reason. Save, then check the refreshed mapping.",
  ],
);

const officePricing = guide(
  "Shipping office",
  [
    "Check the office",
    "Confirm the office name and address before changing its pickup prices.",
  ],
  [
    "Update pickup charges",
    "Open Update pickup prices and enter the base pickup and per-kilometre amounts in naira.",
  ],
  [
    "Save and check",
    "Give a reason, save, then review the refreshed prices. If the save result is unclear, retry with the same details.",
  ],
);

const feeDetails = guide(
  "Fee configuration",
  [
    "Check the fee type",
    "Review the current fee and the units shown. Only supported fee types have editable fields.",
  ],
  [
    "Enter the new values",
    "Fields marked ₦ take naira. Multipliers and rider share use the units shown beside their fields.",
  ],
  [
    "Save the changed fields",
    "Give a reason and choose Save fee changes. Leave values you want to keep unchanged.",
  ],
);

const feeList = guide(
  "Fee catalogue",
  [
    "Choose the catalogue",
    "Select Ride fares or Shipping settings. Review the fee name, type and units before opening a fee.",
  ],
  [
    "Inspect its current values",
    "Open a fee to see its current configuration and any fields you can edit. Monetary fields take naira; other fields keep their labelled units.",
  ],
);

const priceHistory = guide(
  "Price change history",
  [
    "Find the change",
    "Review when the change happened, who made it and what changed.",
  ],
  [
    "Compare the values",
    "Choose View change to see the reason and recorded before-and-after values. Unchanged price tiers are left out.",
  ],
  [
    "Check today's tariff",
    "Open current tariff to see the latest prices. The audit record shows what happened at that time and can be downloaded separately.",
  ],
);

const paymentReview = guide(
  "Payment review",
  [
    "Review payment receipts",
    "The list starts with receipts held for review. Filter by status and open a receipt to inspect the payment reference and processing details.",
  ],
  [
    "Check a payment period",
    "Use Start reconciliation to check a period of up to 31 days. The end time is excluded from the period.",
  ],
  [
    "Follow the result",
    "Use the returned job reference in Check reconciliation job. A queued check does not mean a payment has settled.",
  ],
);

const paymentReceipt = guide(
  "Payment receipt",
  [
    "Inspect the payment evidence",
    "Check the payment reference, event and processing status before taking action.",
  ],
  [
    "Replay after fixing the issue",
    "Replay receipt is available for receipts held for review. Resolve the cause first and explain the correction in the reason.",
  ],
  [
    "Check processing again",
    "Replay queues another attempt. Refresh the receipt to check the outcome.",
  ],
);

const withdrawalDetails = guide(
  "Withdrawal details",
  [
    "Claim the request",
    "Super and regular admins can claim a requested withdrawal. Claim for payment assigns it to you; it does not send money.",
  ],
  [
    "Make the bank transfer",
    "After claiming, show the bank details and confirm the destination and amount. Make the transfer separately from the company bank account.",
  ],
  [
    "Record the confirmed payment",
    "Once the bank confirms success, enter the transfer reference, payment time with timezone and reason. Choose Record successful bank transfer.",
  ],
  [
    "Resolve uncertain payments",
    "If the bank outcome is unclear, keep the request claimed while checking the bank statement. Reject only after confirming no payment was made.",
  ],
);

const withdrawalExport = guide(
  "Export withdrawals",
  [
    "Choose the report",
    "Select a status, CSV or JSON, and 1–2,000 records per file. Exports leave out bank account numbers.",
  ],
  [
    "Download each part",
    "Download the first file, then use Download next withdrawal page until Export complete appears.",
  ],
  [
    "Start over to change filters",
    "Choose Start a new export to use a different status or format. Downloading a report does not make any payments.",
  ],
);

export const pricingFinanceHelp: FeatureHelp[] = [
  {
    path: "/export-rates",
    page: guide(
      "International shipment tariffs",
      [
        "Find a tariff",
        "The Tariffs tab shows active international shipment tariffs. Turn on Show drafts and retired tariffs to see the others.",
      ],
      [
        "Review prices by country",
        "Open a tariff and choose a destination in Prices. Countries in the same zone share prices.",
      ],
      [
        "Prepare new prices",
        "Use Create tariff to start a draft, or clone an existing tariff. Save your edits, review them and publish when ready.",
      ],
    ),
    sections: {
      "Active international shipment tariffs": guide(
        "Active international shipment tariffs",
        [
          "Choose a tariff",
          "Check its carrier, direction and cargo type, then open the tariff to review prices by country.",
        ],
        [
          "Show the other tariffs",
          "Turn on Show drafts and retired tariffs to include tariffs that are not active.",
        ],
      ),
      "All international shipment tariffs": guide(
        "All international shipment tariffs",
        [
          "Check the status",
          "The list includes active tariffs, drafts and retired tariffs. Open the tariff you want to review.",
        ],
        [
          "Continue a draft",
          "A draft can be edited and published after review. Clone an active or retired tariff before changing its prices.",
        ],
      ),
      "Shipping countries": countryList,
      Records: countryList,
      "Create international draft": guide(
        "Create international draft",
        [
          "Set the tariff details",
          "Enter a name, choose the carrier, direction and cargo type, then give a reason.",
        ],
        [
          "Add prices next",
          "Creating the draft opens Edit & publish. Add its prices and country mappings, then review and publish.",
        ],
      ),
    },
  },
  {
    path: "/export-rates/tariffs",
    page: shippingTariff,
    sections: {
      "Current tariff": shippingTariff,
      "Tariff snapshot": shippingTariff,
      "International prices": internationalPrices,
      Prices: internationalPrices,
      "Country zones": countryZones,
      "Tariff information": tariffInformation,
      "Edit prices": priceEditing,
      "Tariff settings": guide(
        "Tariff settings",
        [
          "Update draft details",
          "Open Tariff details to change the name, carrier, direction, cargo type or volumetric divisor. Give a reason and save the changed fields.",
        ],
        [
          "Assign countries to zones",
          "Open Add or update country mappings and choose each country and its price zone. Saving changes only the countries you enter; review the mappings before publishing.",
        ],
      ),
      "Publish changes": publishTariff,
      "Other tariff actions": guide(
        "Other tariff actions",
        [
          "Copy the tariff",
          "Clone as a new draft makes an editable copy. Copying does not change live prices.",
        ],
        [
          "Remove draft entries",
          "Delete weight bands or Delete country mappings removes only the listed rows. Other draft prices and mappings stay unchanged.",
        ],
        [
          "Retire an unused draft",
          "Archive unused draft retires this draft without publishing its prices. Give a reason before confirming.",
        ],
      ),
      "Upload price-list PDF": pdfPrices,
      "PDF upload": pdfPrices,
      "Price-list PDF": pdfPrices,
    },
  },
  {
    path: "/export-rates/countries",
    page: countryPolicy,
    sections: { "Country policy": countryPolicy },
  },
  {
    path: "/delivery-zones",
    page: guide(
      "Local shipment tariffs",
      [
        "Upload domestic prices",
        "Open Upload domestic rate PDF, select the service and PDF, then preview prices. Review all six zones and confirm publication. Premium is selected by default.",
      ],
      [
        "Choose the service and zone",
        "Open a tariff to review its delivery service, zone and weight prices.",
      ],
      [
        "Create a draft",
        "In Create tariff, choose a delivery service and zone. Create the draft, add prices and publish after reviewing them.",
      ],
      [
        "Manage service coverage",
        "Use Local shipping types for service names and delivery details. States & zones controls each state's local zone.",
      ],
    ),
    sections: {
      "Local shipment tariffs": guide(
        "Local shipment tariffs",
        [
          "Find the right tariff",
          "Check the delivery service, zone and status, then open the tariff to review its weight prices.",
        ],
        [
          "Prepare a price change",
          "Edit an existing draft or clone an active or retired tariff. Use Create tariff when you need a new tariff for a service and zone.",
        ],
      ),
      "Local shipping types": localTypes,
      "States & local zones": stateList,
      Records: stateList,
      "Create local draft": guide(
        "Create local draft",
        [
          "Choose a service and zone",
          "Select the delivery service and the zone this tariff will cover. Use Refresh services if a new service is missing.",
        ],
        [
          "Add prices next",
          "Give a reason and create the draft. Add weight bands and prices in Edit & publish, then review and publish.",
        ],
      ),
    },
  },
  {
    path: "/delivery-zones/tariffs",
    page: deliveryTariff,
    sections: {
      "Current tariff": deliveryTariff,
      "Tariff snapshot": deliveryTariff,
      "Weight bands & prices": domesticPrices,
      Prices: domesticPrices,
      "Tariff information": tariffInformation,
      "Edit prices": priceEditing,
      "Tariff settings": guide(
        "Tariff settings",
        [
          "Update draft details",
          "Open Tariff details to choose the delivery service and zone or change the volumetric divisor.",
        ],
        [
          "Save the changed fields",
          "Give a reason and choose Save draft information. Review the service, zone and prices before publishing this draft.",
        ],
      ),
      "Publish changes": publishDeliveryTariff,
      "Other tariff actions": guide(
        "Other tariff actions",
        [
          "Copy the tariff",
          "Clone as a new draft makes an editable copy. Copying does not change live prices.",
        ],
        [
          "Remove draft weight bands",
          "Use Delete weight bands to enter the weights to remove, then give a reason. Only those bands are deleted; other draft prices stay unchanged.",
        ],
        [
          "Retire an unused draft",
          "Archive unused draft retires this draft without publishing its prices. Give a reason before confirming.",
        ],
      ),
    },
  },
  {
    path: "/delivery-zones/local-types",
    page: localTypeDetails,
    sections: { "Type details": localTypeDetails },
  },
  {
    path: "/delivery-zones/states",
    page: stateMapping,
    sections: { "State mapping": stateMapping },
  },
  {
    path: "/head-offices",
    page: guide(
      "Head offices",
      [
        "Find the office",
        "Review office names, addresses, pickup charges and active status. The list includes inactive offices.",
      ],
      [
        "Update pickup prices",
        "Open an office to change its base pickup and per-kilometre charges. Enter the amounts in naira and give a reason.",
      ],
    ),
    detail: officePricing,
    sections: {
      "Shipping office": officePricing,
      Records: guide(
        "Office list",
        [
          "Check the location",
          "Use the office name and address to find the right office. Check its active status before opening it.",
        ],
        [
          "Review pickup charges",
          "Open the office to see its current pickup prices and the fields available to update.",
        ],
      ),
    },
  },
  {
    path: "/fees",
    page: guide(
      "Fees & pricing",
      [
        "Choose a catalogue",
        "Select Ride fares or Shipping settings to see the relevant fees.",
      ],
      [
        "Check the units",
        "Money is displayed in naira. Percentages, multipliers and other fee values keep the units shown.",
      ],
      [
        "Open a fee",
        "Review its current values and edit the supported fields. Give a reason before saving.",
      ],
    ),
    detail: feeDetails,
    sections: {
      Records: feeList,
      "Fee configuration": feeDetails,
      "Current fee": feeDetails,
    },
  },
  {
    path: "/pricing-audit",
    page: priceHistory,
    sections: {
      "Price change history": priceHistory,
      "Latest pricing revision": guide(
        "Latest pricing revision",
        [
          "Check the latest update",
          "This section shows the most recent recorded pricing revision.",
        ],
        [
          "Inspect the changes",
          "Use Price change history below to see who made a change, why and the values before and after it.",
        ],
      ),
    },
  },
  {
    path: "/payments",
    page: paymentReview,
    detail: paymentReceipt,
    sections: {
      Records: guide(
        "Payment receipts",
        [
          "Filter by status",
          "The list starts with receipts held for review. Choose another status to inspect other processing stages.",
        ],
        [
          "Inspect a receipt",
          "Open the receipt to review its payment reference and recorded processing details before deciding what to do.",
        ],
      ),
      "Check reconciliation job": guide(
        "Reconciliation progress",
        [
          "Use the job reference",
          "Copy the job reference returned by Start reconciliation into Check reconciliation job, then choose Look up.",
        ],
        [
          "Read the outcome",
          "Check the reported status and results. Refresh this section while the check is still running.",
        ],
      ),
    },
  },
  {
    path: "/withdrawals",
    page: guide(
      "Withdrawals",
      [
        "Find the request",
        "Filter by status, then open a withdrawal to check the amount and whether it is assigned to you.",
      ],
      [
        "Follow the payment steps",
        "Super and regular admins claim a request, make the bank transfer separately, then record confirmed success.",
      ],
      [
        "Download a report",
        "Super and regular admins can use Export to download withdrawal records. Follow Download next withdrawal page until the export is complete.",
      ],
    ),
    detail: withdrawalDetails,
    sections: {
      Records: guide(
        "Withdrawal requests",
        [
          "Filter the requests",
          "Choose a status and apply the filter. Check the amount and Assigned to me column before opening a request.",
        ],
        [
          "Open the details",
          "Review the request before claiming it for payment. Only the admin who claims it can open the full bank details for payment.",
        ],
      ),
      "Export withdrawals": withdrawalExport,
      "Payment destination": guide(
        "Payment destination",
        [
          "Verify the bank details",
          "Check the account name, bank, account number and withdrawal amount before transferring.",
        ],
        [
          "Record confirmed success",
          "Make the transfer from the company bank account. Return to the withdrawal to record the reference and time after the bank confirms success.",
        ],
      ),
    },
  },
];
