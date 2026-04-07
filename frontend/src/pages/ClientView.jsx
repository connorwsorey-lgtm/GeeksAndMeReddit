import { useParams } from "react-router-dom";

export default function ClientView() {
  const { id } = useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Client Dashboard</h1>
      <p className="text-gray-500">
        Client #{id} dashboard with stats and charts will be built in Step 10.
      </p>
    </div>
  );
}
