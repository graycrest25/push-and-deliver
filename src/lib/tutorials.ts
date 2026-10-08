export interface TutorialStep {
  title: string;
  description: string;
}
export interface Tutorial {
  title: string;
  steps: TutorialStep[];
}

const step = (title: string, description: string): TutorialStep => ({
  title,
  description,
});
const guide = (title: string, ...steps: TutorialStep[]): Tutorial => ({
  title,
  steps,
});
const pageScope = step(
  "Work with the current page",
  "Search, filters, summaries, and exports on paginated lists apply to the records currently loaded. Use the pagination controls to move to another page, then search or filter again.",
);
const permissions = step(
  "Check your available actions",
  "Your admin role determines which actions are available. A hidden or disabled control may be restricted to another role or unavailable for the record’s current state. Wait for a success message after saving; if an error appears, review it before trying again.",
);

export const pageTutorials: Record<string, Tutorial> = {
  "/dashboard": guide(
    "Overview",
    step(
      "Start with the platform totals",
      "Review the counts for users, riders, restaurants, and merchants to understand the platform. Use Refresh to request the latest figures. If a figure could not load, refresh before relying on it.",
    ),
    step(
      "Find work that needs attention",
      "Review Needs attention for pending operational work, then follow its links to the relevant list. The shortcuts at the top also take you directly to the order areas available to your role.",
    ),
    step(
      "Check availability and verification",
      "Platform availability shows the current app configuration. Account verification groups partners by verification state. Expand optional insights to explore more detail.",
    ),
  ),
  "/shipment-orders": guide(
    "Shipment orders",
    step(
      "Find a shipment",
      "Use the search field and shipment or clearance filters to narrow the loaded records. Check the shipment ID, sender, amount, and status before opening a row.",
    ),
    pageScope,
    step(
      "Review the shipment",
      "Open a shipment row to see its sender, receiver, locations, documents, and assigned rider. Express shipments also show item weight and dimensions.",
    ),
    step(
      "Update or collect payment",
      "On the details page, authorised admins can change an active shipment’s status. Cancelled and delivered shipments are locked. Super admins can create an express shipment checkout link; pay-later orders start with the total amount, while other orders collect an additional fee.",
    ),
  ),
  "/restaurant-orders": guide(
    "Restaurant orders",
    step(
      "Locate the order",
      "Search the loaded restaurant orders and compare the order ID, customer, restaurant, amount, and status. Open the matching row to inspect its details.",
    ),
    pageScope,
    step(
      "Check items and delivery",
      "Review the customer and restaurant information, ordered items, pickup and drop-off addresses, and order summary. The status display reports the order’s progress.",
    ),
    step(
      "Confirm a cash payment",
      "For an unpaid cash order, an authorised admin can use Mark as Paid after confirming receipt. Wallet orders and already-paid orders do not offer this action.",
    ),
  ),
  "/product-orders": guide(
    "Product orders",
    step(
      "Choose the order status",
      "Use the All, Pending, Confirmed, Accepted, On Route, Completed, or Cancelled tabs to view the matching loaded orders. Search the current page to locate a specific order.",
    ),
    pageScope,
    step(
      "Inspect the order",
      "Open an order to review its customer, products, delivery information, amount, and current status. These details help you confirm that you are handling the correct purchase.",
    ),
    step(
      "Check the payment",
      "Review Payment Status before taking action. If an unpaid cash order offers Mark as Paid, use it only after confirming payment. The order status is displayed for reference.",
    ),
  ),
  "/ride-hailing": guide(
    "Ride hailing",
    step(
      "Find the ride or courier order",
      "Search the loaded records and use the available type and payment filters. Compare the rider, customer, route, amount, and current status before opening a row.",
    ),
    pageScope,
    step(
      "Review the journey",
      "Open a record to see the pickup, destination, customer, rider, and payment details. Cancelled rides also show cancellation information when it was recorded.",
    ),
    step(
      "Check cash collection",
      "An unpaid cash record may offer Mark as Paid to authorised admins. Confirm payment before using it. The ride status display shows progress and does not change it.",
    ),
  ),
  "/support-tickets": guide(
    "Support tickets",
    step(
      "Choose an open ticket",
      "Select a ticket from the left list to load its conversation. The preview and time help identify recent activity. Closed tickets are disabled and cannot be reopened.",
    ),
    step(
      "Read the conversation",
      "Review the messages and user ID before replying. Use the message pagination controls to see other loaded pages of the conversation.",
    ),
    step(
      "Send a reply",
      "Type your response in the message box and send it. Wait for it to appear in the conversation. If sending fails, check the error and try again.",
    ),
    step(
      "Close a resolved ticket",
      "Use the status switch only when the issue is resolved. Closing sends the text currently in the message box as the closing message, or a default closing message if the box is empty. Closing is permanent.",
    ),
  ),
  "/users": guide(
    "Users",
    step(
      "Find a customer",
      "Search the current page by the available customer details. Review the summary figures and open a matching user row to inspect the account.",
    ),
    pageScope,
    step(
      "Review account information",
      "The detail page shows personal information, wallet and referral information, and transaction history. Check the account identity before interpreting its balance or transactions.",
    ),
    step(
      "Explore or export",
      "Expand optional insights for wallet and referral comparisons. Use the export action to download the loaded results, with the same current-page limits as the list.",
    ),
  ),
  "/riders": guide(
    "Riders",
    step(
      "Locate a rider",
      "Search or filter the loaded riders and check their verification state. Open the matching rider to review their profile.",
    ),
    pageScope,
    step(
      "Review verification evidence",
      "Inspect personal and vehicle information, verification images, and identity information before deciding whether the rider is ready for approval.",
    ),
    step(
      "Apply an available action",
      "Depending on your role, the list or detail page offers verification, blocking, or status actions. Review the selected rider and any requested report before saving.",
    ),
    permissions,
  ),
  "/vendors": guide(
    "Restaurants",
    step(
      "Find the restaurant",
      "Search the loaded restaurants and inspect verification states. Open the matching record to review the business.",
    ),
    pageScope,
    step(
      "Review the business",
      "Check Business Information, Operating Hours, More Details, and Business Documents. Transaction History helps you inspect the restaurant’s recorded financial activity.",
    ),
    step(
      "Manage verification",
      "Authorised admins can use the available verify, block, unblock, or edit actions. Inspect the business documents and current status before saving a change.",
    ),
    permissions,
  ),
  "/ecommerce-merchants": guide(
    "E-commerce merchants",
    step(
      "Choose a merchant",
      "Use the All, Verified, or Unverified tabs and available search to find a merchant. Open its details, products, or transactions using the corresponding row action.",
    ),
    pageScope,
    step(
      "Review the store",
      "The merchant detail page shows basic and store information, storefront, sales metrics, and wallet settings. Use the available edit action only after checking the correct business.",
    ),
    step(
      "Inspect products and transactions",
      "Products opens the merchant’s catalogue; open a product to see its images, pricing, available colours, and variants. Transactions opens the merchant’s recorded financial history.",
    ),
    permissions,
  ),
  "/withdrawals": guide(
    "Withdrawals",
    step(
      "Find the withdrawal request",
      "Search by account name, bank, or user ID. Use the status and date filters to narrow the loaded requests, then compare the recipient, bank details, amount, and reference.",
    ),
    pageScope,
    step(
      "Review the outcome before editing",
      "Use an available edit action to inspect a request’s current status and allowed replacement statuses. Confirm the actual payment outcome before changing the record; this status action records an outcome.",
    ),
    step(
      "Save and verify",
      "Select the appropriate status and save. Wait for the success message and check the updated row. Some requests cannot be edited because of their state or your permissions.",
    ),
    permissions,
  ),
  "/fees": guide(
    "Fees",
    step(
      "Choose a fee configuration",
      "Find the relevant service in Platform Fees. Review its booking fee, distance, time, weight, minimum fare, and surge values so you edit the intended service.",
    ),
    step(
      "Edit the relevant fields",
      "Open the edit action and change the fields that apply to that fee. Read each label and unit carefully: a rate, a fixed amount, and a multiplier have different effects.",
    ),
    step(
      "Save the configuration",
      "Review the entered values, save, and wait for confirmation. Check the updated table before moving on. Cancel closes the editor without saving the edits.",
    ),
    permissions,
  ),
  "/export-rates": guide(
    "Export rates",
    step(
      "Read the rate table",
      "Find the shipment weight in kilograms, then locate the destination’s zone column. The table displays the configured export rate for that weight and zone.",
    ),
    step(
      "Edit the weight row",
      "Use the row’s edit action to open its zone rates. Confirm the weight and change the appropriate zone value rather than a neighbouring destination zone.",
    ),
    step(
      "Save and review",
      "Save the edited rates and wait for confirmation. Check the weight row again to verify the intended zone was updated.",
    ),
    permissions,
  ),
  "/delivery-zones": guide(
    "Delivery zones",
    step(
      "Find a state",
      "Search the loaded states by name. Expand a state to load its local government areas (LGAs); a collapsed state has not necessarily loaded its LGA records yet.",
    ),
    pageScope,
    step(
      "Choose an LGA",
      "In the expanded state, locate the correct LGA and review its current delivery fee. Use the LGA pagination controls to view additional records.",
    ),
    step(
      "Edit the delivery fee",
      "Use the LGA’s edit action, enter the new fee, and save. Wait for Delivery fee updated and confirm the displayed value. Cancel abandons the edit.",
    ),
  ),
  "/dhl-zones": guide(
    "DHL zones",
    step(
      "Find a destination",
      "Search Zone Configuration by country or code, then check the country, country code, and current zone number.",
    ),
    step(
      "Change the zone",
      "If your role permits editing, open the destination’s edit action and enter its new zone number. The zone identifies which destination group applies to that country.",
    ),
    step(
      "Save the mapping",
      "Review the destination and zone before saving. Wait for confirmation and check the updated row. Cancel leaves the existing mapping in place.",
    ),
    permissions,
  ),
  "/coupons": guide(
    "Coupons",
    step(
      "Review existing discounts",
      "Inspect All Coupons to see each code, discount percentage, and active state. Check existing codes before creating another coupon.",
    ),
    step(
      "Create a coupon",
      "Use the create action and complete the fields shown in the form. Review the code and discount percentage, then submit and wait for confirmation.",
    ),
    step(
      "Update or remove a coupon",
      "The edit action changes the discount percentage and active state. The delete action removes the coupon; review the selected code and any confirmation before proceeding.",
    ),
    permissions,
  ),
  "/referrals": guide(
    "Referrals",
    step(
      "Find a referral record",
      "Search the loaded referral records and compare the summary figures. Open a referral row to inspect the users associated with it.",
    ),
    pageScope,
    step(
      "Review referred users",
      "On the detail page, inspect Referred Users to understand who is linked to the referral. Use the displayed identifiers and account details to distinguish similar names.",
    ),
    step(
      "Export the loaded records",
      "Use the export action when you need a copy of the loaded referral results. Move through additional pages separately when reviewing more records.",
    ),
  ),
  "/generated": guide(
    "Generated referrals",
    step(
      "Create a campaign link",
      "Choose Create Referral, enter a descriptive campaign name, and submit. Wait for the generated referral to appear in the list.",
    ),
    step(
      "Share and track",
      "Use the copy action to copy the generated URL or open it to inspect the link. Review its referral count, expiry, and status when tracking the campaign.",
    ),
    step(
      "Manage an existing link",
      "Use Regenerate when a replacement link is needed. Check and copy the resulting URL before sharing it. Delete removes the selected referral; confirm that you chose the correct campaign.",
    ),
    pageScope,
  ),
  "/general-notifications": guide(
    "Notifications",
    step(
      "Prepare a notification",
      "Open Send General Notification. Enter a clear title and message body that explain what recipients need to know or do.",
    ),
    step(
      "Choose the audience",
      "Select Users, Riders, Restaurants, or Merchants as the target user type. Review the audience, title, and message carefully before submitting.",
    ),
    step(
      "Review the history",
      "After confirmation, inspect Notification History for the title, message, target, and date. An available delete action removes the stored notification record; do not assume it recalls a message recipients have already seen.",
    ),
    permissions,
  ),
  "/app-config": guide(
    "App configuration",
    step(
      "Manage Ten Seconds game rules",
      "The game rules section loads the current configuration for this environment. Super and regular admins can enable the game, choose the active difficulty, and edit speed and timing tolerance for each level. Review the values and choose Save game rules to apply changes.",
    ),
    step(
      "Select the correct app and platform",
      "In App Version Settings, check the app name and platform badge before editing. Each configuration belongs to the app and platform shown on its card.",
    ),
    step(
      "Set the version requirement",
      "Edit Version and use its Save button to persist the value. Force Update saves through its switch and controls whether users must update to continue.",
    ),
    step(
      "Manage general settings",
      "Review General Settings for app availability and bonus options. Read each label before changing it. Switches save immediately; fields with Save buttons require that button.",
    ),
    step(
      "Confirm your changes",
      "Wait for the success message after each change and check Configuration Summary. View-only roles can inspect these values but cannot save changes.",
    ),
  ),
  "/admin/users": guide(
    "Admin accounts",
    step(
      "Choose Users or Admins",
      "Users lists customer accounts that can be assigned admin access. Admins lists existing admin accounts. Search applies to the currently loaded records in the active list.",
    ),
    pageScope,
    step(
      "Choose the account and role",
      "Confirm the account’s email, then choose Super Admin, Regular Admin, Customer Care, or Verifier in its access selector. Each role grants different access to this workspace.",
    ),
    step(
      "Review the saved access",
      "The selection saves the role change. Wait for confirmation before making another change. Remove admin access revokes that account’s admin role. Your own account’s selector is disabled to prevent changing your own access.",
    ),
  ),
};

const review = (title: string, purpose: string, checks: string, next: string) =>
  guide(
    title,
    step("What this section does", purpose),
    step("Review the details", checks),
    step("Use the information", next),
  );

export const sectionTutorials: Record<string, Tutorial> = {
  "ten seconds game rules": guide(
    "Ten Seconds game rules",
    step(
      "Load the saved rules",
      "This section reads the Ten Seconds game settings from Firebase for the current environment. Super and regular admins can manage them. If loading fails, use Retry loading game rules; if no document exists, use the suggested settings and review them before creating it.",
    ),
    step(
      "Choose availability and difficulty",
      "Game enabled controls whether the game is available. Active difficulty chooses Easy, Medium, or Hard. Changing either control edits the form; it does not save immediately.",
    ),
    step(
      "Set each level’s timing",
      "Speed multiplier scales the game speed: 0.5 is half the base speed, 1 is the base speed, and 2 is twice the base speed. Enter a value greater than 0. Tolerance is the allowed timing margin in milliseconds; use a whole number of 0 or higher.",
    ),
    step(
      "Save or discard your edits",
      "Choose Save game rules to apply all the form’s values together, then wait for confirmation. Discard changes restores the loaded values. For a missing document, Create game rules saves the reviewed suggested settings. A failed save keeps your edits so you can retry.",
    ),
  ),
  "table pagination": guide(
    "Table pagination",
    step(
      "Choose how many rows to load",
      "Use Rows per page to choose the page size. Changing it reloads the list and returns to the first page.",
    ),
    step(
      "Move through records",
      "Previous and Next load another page. The page indicator shows your position and the document count. Navigation is disabled while records are loading or when you reach an end.",
    ),
    pageScope,
  ),
  "business information": review(
    "Business information",
    "This section identifies the restaurant and its recorded business details.",
    "Check its name, contacts, address, and current verification state. Compare the supporting Business Documents before making a verification decision.",
    "Authorised admins can use the edit or verification action offered here. Review the selected status and save, then wait for confirmation.",
  ),
  "basic information": review(
    "Basic information",
    "This section identifies the merchant and its primary account details.",
    "Review the name, contact details, and verification state before editing or inspecting the store.",
    "Use the available verification action if your role permits it. Check the intended status before saving and wait for confirmation.",
  ),
  "store information": review(
    "Store information",
    "This section describes the merchant’s store and its recorded contact or location details.",
    "Compare the store name, description, and address with the merchant you selected.",
    "Use the details to answer store queries and distinguish similar businesses. Review products separately for catalogue and pricing information.",
  ),
  storefront: review(
    "Storefront",
    "This section shows the merchant’s available storefront presentation.",
    "Review the displayed store image or details to identify the business. Missing media means no image is available in this record.",
    "Use the presentation together with Store Information when checking the merchant. Viewing it does not change the store.",
  ),
  "sales metrics": review(
    "Sales metrics",
    "This section summarises the sales figures recorded on the merchant profile.",
    "Read each metric’s label and compare the recorded figures with the merchant’s transaction history when investigating a specific payment.",
    "Use the figures as an overview; inspect individual transactions for their own amounts and statuses.",
  ),
  "wallet & settings": review(
    "Wallet & settings",
    "This section presents the merchant’s recorded wallet information and settings.",
    "Read the balance and each setting’s label. A wallet balance is separate from a particular order’s payment status.",
    "Use the transaction history to investigate changes to the wallet. Only use editing controls explicitly available to your role.",
  ),
  "wallet & referrals": review(
    "Wallet & referrals",
    "This section shows the user’s recorded wallet and referral information.",
    "Check the wallet amount and referral details against the selected user’s identity.",
    "Review Transaction History for specific wallet activity. Referral information describes the recorded relationship and does not itself confirm a payment.",
  ),
  "wallet & bank information": review(
    "Wallet & bank information",
    "This section displays the rider’s wallet and recorded bank details.",
    "Check the wallet balance and bank account information carefully, especially when investigating a withdrawal query.",
    "Compare specific payments with Transaction History and the matching withdrawal request. Viewing bank details does not send money.",
  ),
  "more details": review(
    "More details",
    "This section contains additional recorded information about the restaurant.",
    "Read each available field alongside Business Information and Operating Hours to understand the restaurant’s setup.",
    "Use these details to resolve business queries. Missing fields mean the record has not supplied that information.",
  ),
  "restaurant information": review(
    "Restaurant information",
    "This section identifies the restaurant fulfilling the order.",
    "Review the business name and contact details, then compare its pickup address with the delivery route.",
    "Use these details to coordinate order preparation. This display does not change the restaurant or the items ordered.",
  ),
  "vendor information": review(
    "Vendor information",
    "This section identifies the business associated with the product.",
    "Check the vendor’s name and available contact or store details against the product you are viewing.",
    "Use this information to direct product questions to the correct business. Viewing the vendor does not change the product listing.",
  ),
  "vendor details": review(
    "Vendor details",
    "This section identifies the business associated with this order.",
    "Review its recorded business details and compare them with the products in the order.",
    "Use these details when investigating fulfilment queries. This section displays the business rather than replacing it.",
  ),
  "trip details": review(
    "Trip details",
    "This section presents the recorded journey information for the ride or courier order.",
    "Read the journey fields and units, then compare the pickup and drop-off addresses below.",
    "Use these details to explain the route and recorded charge. Check Ride Status separately to understand progress.",
  ),
  "note for rider": review(
    "Note for rider",
    "This section contains the customer’s delivery instructions for the rider.",
    "Read the complete note before coordinating pickup or drop-off. A missing note means no extra instruction was recorded.",
    "Use the note alongside the delivery address and customer details. Reading it does not send a new message to the rider.",
  ),
  "note for restaurant": review(
    "Note for restaurant",
    "This section contains the customer’s instructions for the restaurant.",
    "Read the note alongside the ordered items to understand any recorded preparation request.",
    "Use it when discussing the order with the restaurant. Viewing this section does not edit the note or send a new instruction.",
  ),
  "select color": review(
    "Select color",
    "This section lets you inspect the product’s available colours.",
    "Choose a displayed colour to load its associated product information. Wait for any loading state to finish before comparing details.",
    "Review the updated information and available variants. Selecting a colour is a preview action and does not place an order.",
  ),
  "select variant": review(
    "Select variant",
    "This section lets you inspect the product’s available variants.",
    "Choose a listed variant to see its details, or choose the base product option to return to the main product.",
    "Compare the displayed price and stock for the selected variant. This selection changes the preview and does not modify the catalogue.",
  ),
  "product details": review(
    "Product details",
    "This section shows the base product’s recorded description, price, and availability.",
    "Review its images and labelled fields. Use Select Color or Select Variant when offered to inspect a particular option.",
    "Compare the selected option’s details before answering a product query. This page previews the catalogue and does not create a purchase.",
  ),
  "variant details": review(
    "Variant details",
    "This section shows information for the currently selected product variant.",
    "Check the variant name, price, stock, and other available fields. These values may differ from the base product.",
    "Choose a different variant to compare it, or return to the base product option. Previewing a variant does not edit it.",
  ),
  "order status": review(
    "Order status",
    "This section shows how far the order has progressed.",
    "Read the current status and confirm that the real shipment has reached the next stage before selecting it.",
    "For shipments, choose an available status to save it immediately. Cancelled and Delivered to Destination are final and disable further changes. Other order types display their status for reference.",
  ),
  "ride status": review(
    "Ride status",
    "This section reports the ride’s current progress.",
    "Check whether the ride is requested, accepted, on route, completed, cancelled, or expired.",
    "Use the status to answer progress questions. This display does not offer a status editing action; cancellation details appear separately when recorded.",
  ),
  "payment status": review(
    "Payment status",
    "This section indicates whether payment is recorded as paid or unpaid.",
    "Check the payment type and confirm that money was received before marking an unpaid cash order as paid.",
    "If your role and the order allow it, use Mark as Paid and wait for confirmation. Wallet orders and paid orders do not offer this cash confirmation action.",
  ),
  "payment type": review(
    "Payment type",
    "This section identifies the recorded payment method, such as Wallet or Cash.",
    "Compare the method with the paid or unpaid indicator; the method alone does not confirm that payment was received.",
    "Use the method to understand which payment workflow applies. This section displays the method and does not change it.",
  ),
  "total amount": review(
    "Total amount",
    "This section shows the order’s recorded total in naira.",
    "Confirm the amount against the relevant order and item details before discussing charges with a customer.",
    "For an express pay-later shipment, the payment-link form starts with this total. For an additional shipment fee, enter only the extra charge in the separate fee form.",
  ),
  "shipment fee payment": guide(
    "Shipment fee payment",
    step(
      "Collect the pay-later shipment fee",
      "This form creates a checkout link for an express shipment that will be paid later. It is available to super admins. Check the sender email before proceeding; a missing email prevents link creation.",
    ),
    step(
      "Review the amount",
      "The amount starts with the shipment’s total amount in naira. Adjust it if needed to the shipment fee you intend to collect. Enter a positive amount.",
    ),
    step(
      "Confirm weight and reference",
      "Final weight is optional: leave it blank to preserve the existing weight, or enter the final weight in kilograms. Keep the generated unique payment reference or provide your own using the permitted characters.",
    ),
    step(
      "Create and share the link",
      "Choose Create checkout link, wait for the URL, then copy and share it with the sender. Creating a link does not confirm payment. Create another payment link starts a new reference and restores the shipment total.",
    ),
  ),
  "additional shipment fee": guide(
    "Additional shipment fee",
    step(
      "Collect an extra shipment charge",
      "Super admins can use this form to create a checkout link for an additional express shipment fee. Confirm that the sender email is available before proceeding.",
    ),
    step(
      "Enter only the additional amount",
      "Enter the extra charge in naira, not the new shipment total. The amount must be greater than zero.",
    ),
    step(
      "Review weight and reference",
      "Leave Final weight blank to keep the existing weight, or enter the final weight in kilograms. Use the generated unique reference or another valid unique payment reference.",
    ),
    step(
      "Create and share the checkout URL",
      "Choose Create checkout link and wait for success. Copy the URL and share it with the sender to collect payment. A generated link does not mean the sender has paid.",
    ),
  ),
  "customer information": review(
    "Customer information",
    "This section identifies the customer or sender connected to the order.",
    "Check the name, phone, and email against the order ID. Missing values mean those details are not available in this record.",
    "Use these details to contact the correct customer. If Mark as Paid is shown here, confirm receipt of the cash payment before switching it on.",
  ),
  "receiver information": review(
    "Receiver information",
    "This section identifies the person expected to receive the shipment.",
    "Review the receiver’s name, phone number, and email. Check the drop-off location separately to confirm where delivery should occur.",
    "Use the details to resolve delivery queries. This section displays the stored information and does not edit the receiver.",
  ),
  "rider information": review(
    "Rider information",
    "This section shows the rider assigned to the order.",
    "Review the rider’s name, phone, photo, and any vehicle details. If no rider is assigned, those details will not be available.",
    "Use this information to identify the assigned delivery partner and coordinate progress. Viewing the section does not assign or replace a rider.",
  ),
  "item details": review(
    "Item details",
    "This section describes the express shipment’s contents and physical measurements.",
    "Review item type, declared value, weight in kilograms, dimensions in centimetres, and the item photo when available.",
    "Use these details to check the parcel being handled. If the final weight needs to be sent with a fee payment, enter it in the separate shipment fee form.",
  ),
  "clearance document": review(
    "Clearance document",
    "This section displays the customs clearance document attached to the shipment.",
    "Check the sea or air consignment label and review the attached document. PDF links open in a new tab; an image may appear directly on the page.",
    "Use the document to check the recorded clearance information. This viewer does not replace or upload documents.",
  ),
  "packing list": review(
    "Packing list",
    "This section provides the shipment’s attached packing list.",
    "Open the document link in a new tab and compare the listed contents with the shipment you are reviewing.",
    "Return to the shipment tab when finished. The document link is for viewing; no upload or replacement action is offered here.",
  ),
  invoice: review(
    "Invoice",
    "This section provides the invoice attached to the shipment.",
    "Open the invoice in a new tab and review the relevant items and values against the shipment record.",
    "Return to the shipment after checking the document. Viewing an invoice does not confirm payment of the shipment fee.",
  ),
  "pickup location": review(
    "Pickup location",
    "This section shows where the order is collected.",
    "Read the full pickup address and compare it with the customer or business details.",
    "Use it to confirm the start of the delivery route. No address provided means a pickup address is missing from this record.",
  ),
  "drop-off location": review(
    "Drop-off location",
    "This section shows the recorded delivery destination.",
    "Read the complete address and compare it with the receiver details before coordinating delivery.",
    "Use it to answer destination questions. This display does not edit the address or mark the order delivered.",
  ),
  "pnd office": review(
    "PnD office",
    "This section shows the PnD office address recorded for the shipment.",
    "Check this address separately from the pickup and drop-off addresses so you identify the correct handling point.",
    "Use the office information when coordinating shipment handling. No address provided means the office address is missing from the record.",
  ),
  "transaction history": review(
    "Transaction history",
    "This section lists recorded financial activity for the selected account or business.",
    "Compare dates, amounts, references, and statuses to identify the transaction you need. Use pagination when offered to inspect more records.",
    "Use the history to investigate payment questions. A row’s status describes that transaction; it does not automatically prove the status of a different order or withdrawal.",
  ),
  "personal information": review(
    "Personal information",
    "This section identifies the selected user or rider.",
    "Check the account’s name and contact details before reviewing its wallet, verification evidence, or history.",
    "For a rider, use any verification actions available to your role only after reviewing the supporting evidence. For a customer, this section provides account details for reference.",
  ),
  "verification images": review(
    "Verification images",
    "This section groups the images submitted as rider verification evidence.",
    "Inspect each available image and compare it with the rider’s personal and vehicle details. Missing evidence should not be treated as verified.",
    "Return to the rider’s verification control after reviewing the evidence. Opening an image does not approve the rider.",
  ),
  "identity verification": review(
    "Identity verification",
    "This section presents identity information supplied for the rider.",
    "Review the available identity details and supporting evidence against the rider’s profile.",
    "Use the evidence when deciding on an available verification action. The display itself does not change verification status.",
  ),
  "vehicle information": review(
    "Vehicle information",
    "This section describes the rider’s registered vehicle.",
    "Compare the model, plate number, colour, and supporting documents or images that are available.",
    "Use the details to identify the vehicle and support verification checks. Review the rider’s current verification state separately.",
  ),
  "business documents": review(
    "Business documents",
    "This section provides the documents attached to the business profile.",
    "Open each available document and check that it relates to the selected restaurant or merchant.",
    "Use the evidence before applying a verification decision. Viewing a document does not approve the business.",
  ),
  "operating hours": review(
    "Operating hours",
    "This section shows the restaurant’s recorded opening schedule.",
    "Check the relevant day and its opening and closing times, including any closed days.",
    "Use the schedule to answer availability questions. These recorded hours are separate from an order’s current status.",
  ),
  "order summary": review(
    "Order summary",
    "This section brings together the recorded items and charges for the order.",
    "Review quantities, item prices, and the displayed total against the order you are handling.",
    "Use the summary to explain the recorded charge. Check the payment indicator separately before treating the order as paid.",
  ),
  "cancellation reason": review(
    "Cancellation reason",
    "This section explains the recorded cancellation information for the ride.",
    "Read the reason and any available cancellation time or related details.",
    "Use the information to answer the customer’s cancellation query. The record’s cancelled status is final and is not reopened here.",
  ),
};

export function tutorialForPath(pathname: string): Tutorial | undefined {
  return Object.entries(pageTutorials).find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`),
  )?.[1];
}

export function tutorialForSection(
  title: string,
  pathname: string,
): Tutorial | undefined {
  const key = title.trim().toLowerCase().replace(/\s+/g, " ");
  const page = tutorialForPath(pathname);
  if (!page || !key) return undefined;
  if (key === "total amount" && pathname === "/withdrawals")
    return review(
      title,
      "This summary adds up withdrawal amounts in the current page’s loaded records.",
      "Check the displayed amount together with the request statuses. A requested amount is not proof that a bank transfer succeeded.",
      "Use the table and filters to inspect individual requests. Load another page to review more withdrawals.",
    );
  const workflowSections: Record<string, string[]> = {
    "/dashboard": [
      "needs attention",
      "platform availability",
      "account verification",
      "operations shortcuts",
    ],
    "/app-config": [
      "configuration summary",
      "app version settings",
      "general settings",
    ],
    "/support-tickets": [
      "support tickets",
      "ticket conversation",
      "close ticket",
    ],
    "/admin/users": ["users", "admins"],
    "/shipment-orders": ["all shipments"],
    "/restaurant-orders": ["all orders"],
    "/ride-hailing": ["all rides"],
    "/product-orders": ["product orders"],
    "/users": ["user details"],
    "/riders": ["rider details"],
    "/vendors": ["restaurant details"],
    "/ecommerce-merchants": ["merchants", "product list"],
    "/withdrawals": ["withdrawal requests"],
    "/fees": ["platform fees"],
    "/export-rates": ["export rates (naira)"],
    "/delivery-zones": ["all states"],
    "/dhl-zones": ["zone configuration"],
    "/coupons": ["all coupons"],
    "/referrals": ["referral details", "referred users"],
    "/generated": ["generated referrals"],
    "/general-notifications": ["notification history"],
  };
  if (
    Object.entries(workflowSections).some(
      ([path, titles]) =>
        (pathname === path || pathname.startsWith(`${path}/`)) &&
        titles.includes(key),
    )
  ) {
    return { title, steps: page.steps };
  }
  const aliases: Record<string, string> = {
    "customer details": "customer information",
    "rider details": "rider information",
    "delivery location": "drop-off location",
    "cancellation details": "cancellation reason",
  };
  if (aliases[key]) return sectionTutorials[aliases[key]];
  if (sectionTutorials[key]) return sectionTutorials[key];
  if (/^order items/.test(key))
    return review(
      title,
      "This section lists the products or food items included in the selected order.",
      "Review each item’s name, quantity, price, and any available options. Compare the items with the customer’s query.",
      "Use Order Summary or Total Amount to check the recorded charge. Viewing the items does not edit the order.",
    );
  if (
    /^(total|active|completed|cancell?ed|paid|unpaid|new |growth|avg |verified|pending|blocked|successful|to |most common|zone numbers)/.test(
      key,
    ) ||
    /distribution|top 10/.test(key)
  ) {
    return review(
      title,
      `This section summarises ${key} so you can assess the records at a glance. It does not change the underlying records.`,
      pathname === "/dashboard"
        ? "These overview figures report platform totals. Use Refresh to request the latest figures; an unavailable figure should be refreshed before you rely on it."
        : pathname === "/dhl-zones"
          ? "Compare the summary with the destination table and current search results."
          : "On paginated lists, these summaries and charts use the current page’s loaded records. Check the list and its filters before interpreting the figure.",
      pathname === "/dashboard"
        ? "Follow the related area’s link to inspect individual records. Your role determines which destinations are available."
        : "Use the related table to inspect individual records. When pagination is available, move to another page to review more records rather than treating this summary as a platform-wide total.",
    );
  }
  if (pathname.startsWith("/app-config")) return { title, steps: page.steps };
  return review(
    title,
    `This section shows ${key} for the selected record. It helps you review this part of the account, business, or order without changing other information.`,
    "Read the field labels and units, and compare the values with the selected record’s identity. Missing values indicate that information is unavailable; they do not confirm a completed action.",
    "Use any explicitly labelled action available in this section if your role permits it. If no editing control is shown, the information is for reference. After saving an available change, wait for its confirmation message.",
  );
}
