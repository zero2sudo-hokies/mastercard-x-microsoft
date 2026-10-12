import { Card, Spinner } from "@/components/ui";

export default function Home() {
  return (
    <div className="p-6">
      <Card title="Dashboard">
        <Spinner label="Map coming next" />
      </Card>
    </div>
  );
}
