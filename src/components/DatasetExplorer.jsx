
import { useEffect, useState } from "react";
import "./DatasetExplorer.css";

const DATASET_URL = "/api/datasets/breast-cancer";

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default function DatasetExplorer() {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDataset() {
      try {
        const response = await fetch(DATASET_URL, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load dataset (HTTP ${response.status}).`
          );
        }

        const data = await response.json();

        if (
          !data ||
          !Array.isArray(data.feature_statistics) ||
          !Array.isArray(data.target_classes) ||
          !Array.isArray(data.preview)
        ) {
          throw new Error("The API returned an invalid dataset response.");
        }

        setDataset(data);
        setError("");
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        setError(err.message || "Unable to load dataset.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDataset();

    return () => controller.abort();
  }, []);

  if (loading) {
    return <p role="status">Loading dataset...</p>;
  }

  if (error) {
    return <p role="alert" className="dataset-error">{error}</p>;
  }

  if (!dataset) {
    return <p role="status">No dataset available.</p>;
  }

  return (
    <section className="dataset-explorer" aria-labelledby="dataset-title">
      <header className="dataset-header">
        <h2 id="dataset-title">{dataset.name}</h2>
        <p>{dataset.description}</p>
      </header>

      <div className="dataset-stats">
        <StatCard label="Samples" value={dataset.rows} />
        <StatCard label="Features" value={dataset.features} />
        <StatCard
          label="Target Classes"
          value={dataset.target_classes.length}
        />
        <StatCard
          label="Missing Values"
          value={dataset.missing_values}
        />
      </div>

      <section className="dataset-section">
        <h3>Target Distribution</h3>

        <div className="target-distribution">
          {dataset.target_classes.map((target) => {
            const percentage = dataset.rows
              ? (target.count / dataset.rows) * 100
              : 0;

            return (
              <div className="target-item" key={target.value}>
                <div className="target-label">
                  <span>{target.label}</span>
                  <span>
                    {target.count} ({percentage.toFixed(1)}%)
                  </span>
                </div>

                <div
                  className="target-progress"
                  role="progressbar"
                  aria-label={`${target.label} proportion`}
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="target-progress-fill"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="dataset-section">
        <h3>Feature Statistics</h3>

        <div className="dataset-table-container">
          <table className="dataset-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Type</th>
                <th scope="col">Mean</th>
                <th scope="col">Min</th>
                <th scope="col">Max</th>
                <th scope="col">Missing</th>
              </tr>
            </thead>

            <tbody>
              {dataset.feature_statistics.map((feature) => (
                <tr key={feature.name}>
                  <th scope="row">{feature.name}</th>
                  <td>{feature.dtype}</td>
                  <td>{formatNumber(feature.mean)}</td>
                  <td>{formatNumber(feature.min)}</td>
                  <td>{formatNumber(feature.max)}</td>
                  <td>{feature.missing_values}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dataset-section">
        <h3>Sample Records</h3>

        <p className="dataset-help">
          Showing the first {dataset.preview.length} records.
        </p>

        <div className="dataset-table-container">
          <table className="dataset-table">
            <thead>
              <tr>
                {Object.keys(dataset.preview[0] || {}).map((column) => (
                  <th scope="col" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {dataset.preview.map((record, index) => (
                <tr key={index}>
                  {Object.entries(record).map(([column, value]) => (
                    <td key={column}>{formatNumber(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="dataset-stat-card">
      <span className="dataset-stat-value">
        {formatNumber(value)}
      </span>
      <span className="dataset-stat-label">{label}</span>
    </div>
  );
}
