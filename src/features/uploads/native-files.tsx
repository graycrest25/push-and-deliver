import { useState } from "react";
import { AssetField } from "./asset-field";
import { UPLOAD_PURPOSES, type UploadPurpose } from "@/lib/uploads";
import { Heading, Notice, ErrorNotice, human } from "@/features/admin/shared";
import { downloadAsset } from "@/features/admin/native-operations";
import { Button } from "@/components/ui/button";
export function NativeFiles() {
  const [purpose, setPurpose] = useState<UploadPurpose>("invoice");
  const [ids, setIds] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <Heading
        title="Files"
        description="Upload and validate files owned by your signed-in account."
      />
      <Notice>
        These files belong to your account. Attaching them to someone else's
        shipment or application requires a supported ownership and attachment
        contract.
      </Notice>
      <label className="block space-y-2 text-sm">
        File purpose
        <select
          className="block h-10 w-full rounded-md border bg-card px-3 sm:w-64"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as UploadPurpose)}
        >
          {UPLOAD_PURPOSES.map((p) => (
            <option key={p} value={p}>
              {human(p)}
            </option>
          ))}
        </select>
      </label>
      <AssetField
        key={purpose}
        id={`native-file-${purpose}`}
        path={`native-files:${purpose}`}
        label="Upload files"
        purpose={purpose}
        multiple
        value={ids[purpose] || []}
        change={(value) =>
          setIds((current) => ({
            ...current,
            [purpose]: Array.isArray(value) ? value : value ? [value] : [],
          }))
        }
      />
      <div className="flex flex-wrap gap-2">
        {(ids[purpose] || []).map((id) => (
          <Button
            key={id}
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await downloadAsset(id);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            Download {id}
          </Button>
        ))}
      </div>
      {error != null && <ErrorNotice error={error} />}
    </div>
  );
}
