import { useTableState } from "@/contexts/TableStateContext";
import { useEffect, useState } from "react";
import {
  adminReferralsService,
  type ReferralFilters,
  type ReferralLimit,
  type ReferralPage,
} from "@/services/admin-referrals.service";

export function useReferralList(filters: ReferralFilters) {
  const [limit, setLimit] = useTableState<ReferralLimit>("table:limit", 10);
  const scope = JSON.stringify([
    filters.referredUid?.trim(),
    filters.referreduserType?.trim(),
    filters.referralCodeUsed?.trim(),
    limit,
  ]);
  const [navigation, setNavigation] = useTableState("table:navigation", {
    scope,
    index: 0,
    cursors: [undefined] as Array<string | undefined>,
  });
  if (navigation.scope !== scope)
    setNavigation({ scope, index: 0, cursors: [undefined] });
  const [revision, setRevision] = useState(0);
  const cursor = navigation.cursors[navigation.index];
  const requestKey = JSON.stringify([
    scope,
    navigation.index,
    cursor,
    revision,
  ]);
  const [result, setResult] = useState<{
    key: string;
    data: ReferralPage;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    adminReferralsService
      .list(filters, limit, cursor, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setFailure({
            key: requestKey,
            message:
              cause instanceof Error
                ? cause.message
                : "Unable to load referrals",
          });
      });
    return () => controller.abort();
  }, [requestKey]);
  const data = result?.key === requestKey ? result.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !data && !error;
  return {
    data,
    error,
    loading,
    limit,
    setLimit,
    pageIndex: navigation.index,
    requestKey,
    retry: () => setRevision((value) => value + 1),
    previous: () => {
      if (!loading && navigation.index > 0)
        setNavigation({ ...navigation, index: navigation.index - 1 });
    },
    next: () => {
      if (!loading && data?.hasMore && data.nextCursor)
        setNavigation({
          ...navigation,
          index: navigation.index + 1,
          cursors: [
            ...navigation.cursors.slice(0, navigation.index + 1),
            data.nextCursor,
          ],
        });
    },
  };
}
