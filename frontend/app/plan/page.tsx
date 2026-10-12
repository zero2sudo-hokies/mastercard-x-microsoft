import { Suspense } from "react";
import PlanPage from "@/components/plan/PlanPage";
import { Spinner } from "@/components/ui";

export default function Plan() {
  return (
    <Suspense fallback={<div className="p-6"><Spinner label="Loading pilot plan" /></div>}>
      <PlanPage />
    </Suspense>
  );
}
