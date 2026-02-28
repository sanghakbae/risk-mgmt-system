import { useEffect, useState } from "react";
import { readSheet } from "../lib/sheetsApi";

export default function RisksStep() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await readSheet("Risks");
      setRows(data);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      {loading
        ? "로딩..."
        : rows.map((r) => (
            <div key={r.id}>
              {r.id} - {r.threat}
            </div>
          ))}
    </div>
  );
}
