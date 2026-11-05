import { useEffect, useState } from "react";
import "./App.css";

export default function App() {
  const [apiStatus, setApiStatus] = useState("Checking...");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackend() {
      try {
        const response = await fetch("/api/health", {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== "ok") {
          throw new Error("Unexpected API health response");
        }

        setApiStatus("Connected");
        setError("");
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        setApiStatus("Disconnected");
        setError(err.message);
      }
    }

    checkBackend();

    return () => controller.abort();
  }, []);

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>AI-Assisted ML Dashboard</h1>
        <p>Train, evaluate, and explore machine learning models.</p>
      </header>

      <section className="status-card" aria-labelledby="api-heading">
        <h2 id="api-heading">Backend Connection</h2>

        <p>
          Status: <strong>{apiStatus}</strong>
        </p>

        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}