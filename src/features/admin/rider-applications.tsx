import { useEffect, useState } from "react";
import { onlineLabel, riderVehicleFilter } from "./rider-filters";
import { apiResponse } from "@/lib/api";
import { ApprovalChecklist } from "./approval-checklist";
import {
  approvalRequirements,
  assertApprovable,
} from "./approval-requirements";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import { readableEnum } from "@/lib/enum-labels";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { segment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CurrentRecord } from "./native-dashboard";
import {
  ActionForm,
  DataList,
  Heading,
  InformationCard,
  Notice,
  RecordView,
  field,
  select,
} from "./shared";
import { downloadAsset } from "./native-operations";
import { reason, reasonField, version } from "./workflow-fields";
const kinds = ["vehicle_photo", "plate_number"] as const;
function DocumentImage({ assetId, kind }: { assetId: string; kind: string }) {
  const [image, setImage] = useState<{ url?: string; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setImage({});
    void apiResponse(`/v1/media/${segment(assetId)}/content`, {
      signal: controller.signal,
    })
      .then((response) => response.blob())
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setImage({ url });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setImage({ error: error.message });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetId]);
  return image.url ? (
    <img
      src={image.url}
      alt={readableEnum(kind)}
      className="max-h-64 max-w-full rounded-lg object-contain"
    />
  ) : (
    <p role={image.error ? "alert" : "status"}>
      {image.error || "Loading photo…"}
    </p>
  );
}
export function RiderApplications() {
  return (
    <div className="space-y-6">
      <Heading
        title="Rider applications"
        description="Inspect submitted information, replace evidence and record a review decision."
      />
      <DataList
        spec={{
          title: "Application queue",
          path: "/v1/admin/riders/applications",
          initialFilters: { status: "pending" },
          defaultPageSize: 25,
          pageSizes: [10, 25, 50],
          pairedDates: true,
          updateFilterDraft: (draft, name) =>
            name === "verificationStatus" &&
            draft.verificationStatus === "blocked"
              ? { ...draft, status: "" }
              : draft,
          search: {
            param: "q",
            label: "Search registered email",
            placeholder: "Enter all or part of an email address",
            help: "Case-insensitive email search. Clear the exact email filter to search by part of an address.",
          },
          key: "items",
          paging: "cursor",
          idKey: "uid",
          filters: [
            riderVehicleFilter,
            select(
              "status",
              ["incomplete", "pending", "approved", "rejected", "unavailable"],
              "Application status",
            ),
            select(
              "verificationStatus",
              ["verified", "blocked", "unverified"],
              "Verification status",
            ),
            field("email", "Exact email address", {
              type: "email",
              required: false,
            }),
            field("startDate", "Start date", { type: "date", required: false }),
            field("endDate", "End date", { type: "date", required: false }),
          ],
          note: "Dates include both selected days in Africa/Lagos, using submission date or account creation date for older applications.",
          columns: [
            { key: "uid", label: "Rider ID" },
            { key: "username", label: "Name" },
            { key: "email" },
            { key: "verificationStatus" },
            { key: "status" },
            { key: "submittedAt" },
          ],
          link: (row) => `/rider-applications/${segment(row.uid)}`,
        }}
      />
    </div>
  );
}
export function RiderApplication() {
  const { id = "" } = useParams();
  const [reviewRevision, setReviewRevision] = useState(0);
  const { adminType } = useCurrentUser();
  const path = `/v1/admin/riders/${segment(id)}/application`;
  return (
    <div className="space-y-6">
      <Link className="text-primary text-sm underline" to="/rider-applications">
        Back to applications
      </Link>
      <Heading title="Rider application" description={id} />
      <CurrentRecord
        title="Application review"
        path={path}
        skeleton={
          <>
            {[
              "Application information",
              "Applicant information",
              "Verification documents",
              "Review decision",
            ].map((title) => (
              <InformationCard key={title} title={title}>
                <RecordSkeleton
                  fields={title === "Applicant information" ? 12 : 6}
                />
              </InformationCard>
            ))}
          </>
        }
      >
        {(data, reload) => (
          <>
            <InformationCard title="Application information">
              <RecordView
                data={{
                  uid: data.uid,
                  status: data.status,
                  verificationStatus: data.verificationStatus,
                  submittedAt: data.submittedAt,
                  version: data.version,
                }}
              />
            </InformationCard>
            <InformationCard title="Applicant information">
              <RecordView
                data={{
                  ...data.applicant,
                  imageUrl: data.applicant?.imageUrl ?? null,
                  onlineStatus: undefined,
                  onlineStatusLabel: onlineLabel(data.applicant || {}),
                }}
              />
            </InformationCard>
            <InformationCard title="Verification documents">
              <div className="space-y-5">
                {(data.documents || []).map((document: any) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 last:border-0"
                    key={document.kind}
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {readableEnum(document.kind)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {document.available
                          ? document.contentType
                          : "Photo is missing or unavailable"}
                      </p>
                    </div>
                    {document.available && document.assetId && (
                      <DocumentImage
                        assetId={document.assetId}
                        kind={document.kind}
                      />
                    )}
                    {document.available && document.assetId && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          downloadAsset(document.assetId).catch((error) =>
                            toast.error(error.message),
                          )
                        }
                      >
                        Download {readableEnum(document.kind)}
                      </Button>
                    )}
                  </div>
                ))}
                {kinds.map((kind) => (
                  <ActionForm
                    key={`${kind}:${data.version}`}
                    onSuccess={() => {
                      toast.success(
                        "Evidence linked. Review the updated application before approving.",
                      );
                      reload();
                    }}
                    action={{
                      title: `Replace ${kind.replaceAll("_", " ")}`,
                      path: `${path}/documents/${kind}`,
                      method: "PUT",
                      versionPath: path,
                      refreshBeforeSubmit: true,
                      preserveRetry: true,
                      description:
                        "Upload a clean image. Linking it returns this application to pending and takes the rider offline.",
                      fields: [
                        field("assetId", "Replacement image", {
                          type: "asset",
                          purpose: kind,
                          riderUid: id,
                          imagesOnly: true,
                        }),
                        reasonField,
                      ],
                      body: (values) => ({
                        assetId: values.assetId,
                        expectedVersion: version(data),
                        reason: reason(values.reason),
                      }),
                    }}
                  />
                ))}
              </div>
            </InformationCard>
            <InformationCard title="Approval checklist">
              <div className="space-y-4">
                <ApprovalChecklist application={data} />
                {canOperate(adminType) ? (
                  <Button asChild variant="outline">
                    <Link to={`/riders/${segment(id)}`}>
                      Open rider profile to correct details
                    </Link>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    An operations administrator can correct profile or vehicle
                    information.
                  </p>
                )}
              </div>
            </InformationCard>
            <InformationCard title="Review decision">
              <div className="space-y-4">
                {data.allowedDecisions?.length ? (
                  data.allowedDecisions.map((decision: string) =>
                    decision === "approve" &&
                    approvalRequirements(data).some((check) => !check.ready) ? (
                      <div key="approval-blocked" className="space-y-3">
                        <Notice>
                          Resolve the checklist requirements and refresh this
                          application before approving.
                        </Notice>
                        <Button disabled>Approve rider</Button>
                      </div>
                    ) : (
                      <ActionForm
                        key={`${decision}:${data.version}`}
                        onSuccess={(result) => {
                          toast.success(
                            typeof result?.message === "string" &&
                              result.message.trim()
                              ? result.message
                              : "Rider application updated",
                          );
                          setReviewRevision((value) => value + 1);
                          // Refresh the applicant profile and application together.
                          reload();
                        }}
                        action={{
                          title:
                            decision === "approve"
                              ? "Approve rider"
                              : "Reject application",
                          path: `${path}/review`,
                          versionPath: path,
                          refreshBeforeSubmit: true,
                          preserveRetry: true,
                          conflictHelp:
                            decision === "approve"
                              ? "Approval can conflict because a requirement is missing, the state changed, or a key was reused. Your reason is preserved. Review the current application below before a fresh attempt."
                              : undefined,
                          renderCurrent:
                            decision === "approve"
                              ? (current) => (
                                  <ApprovalChecklist
                                    application={current}
                                    current
                                  />
                                )
                              : undefined,
                          validateCurrent: (current) => {
                            if (decision === "approve")
                              assertApprovable(current);
                            else if (
                              !current.allowedDecisions?.includes(decision)
                            )
                              throw new Error(
                                "This decision is no longer available. Refresh the application.",
                              );
                          },
                          fields: [reasonField],
                          body: (values) => ({
                            decision,
                            reason: reason(values.reason),
                            expectedVersion: version(data),
                          }),
                        }}
                      />
                    ),
                  )
                ) : (
                  <Notice>
                    No review decision is currently available for this
                    application.
                  </Notice>
                )}
              </div>
            </InformationCard>
          </>
        )}
      </CurrentRecord>
      <DataList
        revision={reviewRevision}
        spec={{
          title: "Review history",
          path: `${path}/reviews`,
          paging: "cursor",
          key: "items",
          columns: [
            { key: "decision" },
            { key: "reason" },
            { key: "reviewedBy" },
            { key: "reviewedAt" },
            { key: "version" },
          ],
          note: "Reviews are shown oldest first. Missing historical reviews are not reconstructed.",
        }}
      />
    </div>
  );
}
