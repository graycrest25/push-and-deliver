import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { segment } from "@/lib/api";
import { CurrentRecord } from "./native-dashboard";
import {
  ActionForm,
  DataList,
  Heading,
  RecordView,
  bool,
  field,
} from "./shared";
import {
  reason,
  reasonField,
  requireChanges,
  version,
} from "./workflow-fields";

const root = "/v1/admin/shipping/local-types";
const guidance =
  "New types start inactive. Publish their zone tariffs before activating them.";
const fields = [
  field("name", "Name"),
  field("details", "Delivery details", { type: "textarea" }),
];

export function LocalShippingTypes() {
  const [revision, setRevision] = useState(0);
  return (
    <section className="space-y-4">
      <DataList
        revision={revision}
        spec={{
          path: root,
          key: "items",
          paging: "cursor",
          defaultPageSize: 100,
          params: { includeInactive: true },
          title: "Local shipping types",
          note: guidance,
          columns: ["id", "name", "details", "active", "version"].map(
            (key) => ({ key }),
          ),
          link: (row) => `/delivery-zones/local-types/${segment(row.id)}`,
        }}
      />
      <ActionForm
        onSuccess={() => setRevision((value) => value + 1)}
        action={{
          title: "Create local shipping type",
          description: guidance,
          method: "POST",
          path: root,
          preserveRetry: true,
          fields: [field("id", "Type ID"), ...fields, reasonField],
          body: (values) => ({
            id: values.id.trim(),
            name: values.name.trim(),
            details: values.details.trim(),
            active: false,
            reason: reason(values.reason),
          }),
        }}
      />
    </section>
  );
}

export function LocalShippingType() {
  const { id = "" } = useParams();
  const path = `${root}/${segment(id)}`;
  return (
    <div className="space-y-6">
      <Link to="/delivery-zones" className="text-sm text-primary underline">
        Back to delivery zones
      </Link>
      <Heading title="Local shipping type" description={guidance} />
      <CurrentRecord path={path} title="Type details">
        {(data, reload) => (
          <>
            <RecordView data={data} />
            <ActionForm
              key={`${id}:${data.version}`}
              onSuccess={reload}
              action={{
                title: "Save local shipping type",
                description: guidance,
                method: "PATCH",
                path,
                versionPath: path,
                preserveRetry: true,
                initial: data,
                fields: [...fields, bool("active", "Active"), reasonField],
                body: (values) => ({
                  ...requireChanges(
                    Object.fromEntries(
                      ["name", "details", "active"]
                        .filter((key) => values[key] !== data[key])
                        .map((key) => [key, values[key]]),
                    ),
                  ),
                  expectedVersion: version(data),
                  reason: reason(values.reason),
                }),
              }}
            />
          </>
        )}
      </CurrentRecord>
    </div>
  );
}
