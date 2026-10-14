import { Suspense } from "react";
import BanksPage from "@/components/banks/BanksPage";
import { Spinner } from "@/components/ui";

export default function Banks() {
  return (
    <Suspense fallback={<div className="p-6"><Spinner label="Loading banks" /></div>}>
      <BanksPage />
    </Suspense>
  );
}
