import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import Dashboard from "./Dashboard";

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6"><Spinner label="Loading dashboard" /></div>}>
      <Dashboard />
    </Suspense>
  );
}
