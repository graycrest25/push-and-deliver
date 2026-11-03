"use client";
import { WorkspaceSkeleton } from "@/components/ui/loading-skeletons";
import dynamic from "next/dynamic";
const App = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => <WorkspaceSkeleton />,
});
export default function Workspace() {
  return <App />;
}
