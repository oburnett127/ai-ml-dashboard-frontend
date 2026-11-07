
import { useEffect, useRef, useState } from "react";
import "./ModelTraining.css";

const TRAINING_URL = "/api/models/train";

function formatPercentage(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function MetricCard({ label, value, description }) {
  return (
    <div className="model-metric-card">
      <span className="model-metric-label">{label}</span>
      <strong className="model-metric-value">
        {formatPercentage(value)}
      </strong>
      <span className="model-metric-description">
        {description}
      </span>
    </div>
  );
}

function ConfusionMatrix({ matrix, labels }) {
  if (
    !Array.isArray(matrix) ||
    matrix.length !== 2 ||
    !matrix.every(
      (row) => Array.isArray(row) && row.length === 2
    ) ||
    !Array.isArray(labels) ||
    labels.length !== 2
  ) {
    return <p>Confusion matrix data is unavailable.</p>;
  }

  return (
    <div className="model-matrix-container">
      <table className="model-matrix">
        <caption>
          Confusion Matrix — rows are actual classes and
          columns are predicted classes
        </caption>
        <thead>
          <tr>
            <th scope="col">Actual / Predicted</th>
            {labels.map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rowIndex) => (
            <tr key={labels[rowIndex]}>
              <th scope="row">{labels[rowIndex]}</th>
              {row.map((value, columnIndex) => (
                <td
                  key={columnIndex}
                  className={
                    rowIndex === columnIndex
                      ? "model-matrix-correct"
                      : "model-matrix-incorrect"
                  }
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ModelTraining() {
  const [training, setTraining] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const controllerRef = useRef(null);
  const trainingRef = useRef(false);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  async function handleTrain() {
    if (trainingRef.current) {
      return;
    }

    trainingRef.current = true;

    const controller = new AbortController();
    controllerRef.current = controller;

    setTraining(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(TRAINING_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Model training failed (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      const metrics = data?.metrics;

      if (
        !metrics ||
        !["accuracy", "precision", "recall", "f1_score"].every(
          (key) =>
            typeof metrics[key] === "number" &&
            Number.isFinite(metrics[key]) &&
            metrics[key] >= 0 &&
            metrics[key] <= 1
        ) ||
        !Array.isArray(data.confusion_matrix) ||
        !Array.isArray(data.class_labels)
      ) {
        throw new Error("Invalid training response received.");
      }

      if (!controller.signal.aborted) {
        setResult(data);
      }
    } catch (err) {
      if (err.name !== "AbortError" && !controller.signal.aborted) {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      if (!controller.signal.aborted) {
        trainingRef.current = false;
        controllerRef.current = null;
        setTraining(false);
      }
    }
  }

  return (
    <section
      className="model-training"
      aria-labelledby="model-training-title"
    >
      <header className="model-training-header">
        <h2 id="model-training-title">Model Training</h2>
        <p>
          Train a Logistic Regression classifier using the
          Breast Cancer Wisconsin dataset.
        </p>
      </header>

      <div className="model-training-actions">
        <button
          type="button"
          className="model-train-button"
          onClick={handleTrain}
          disabled={training}
        >
          {training ? "Training Model..." : "Train Model"}
        </button>

        {training && (
          <p role="status">
            Training and evaluating your model...
          </p>
        )}
      </div>

      {error && (
        <p className="model-training-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="model-training-results">
          <div className="model-training-summary">
            <h3>Training Results</h3>

            <p>
              <strong>Algorithm:</strong> {result.model}
            </p>

            <p>
              <strong>Training samples:</strong>{" "}
              {result.training_samples}
            </p>

            <p>
              <strong>Testing samples:</strong>{" "}
              {result.testing_samples}
            </p>

            <p>
              <strong>Positive class:</strong>{" "}
              {result.positive_class}
            </p>
          </div>

          <div className="model-metrics-grid">
            <MetricCard
              label="Accuracy"
              value={result.metrics.accuracy}
              description="Overall correct predictions"
            />

            <MetricCard
              label="Precision"
              value={result.metrics.precision}
              description="Precision for the positive class"
            />

            <MetricCard
              label="Recall"
              value={result.metrics.recall}
              description="Recall for the positive class"
            />

            <MetricCard
              label="F1 Score"
              value={result.metrics.f1_score}
              description="Balance of precision and recall"
            />
          </div>

          <div className="model-training-matrix">
            <h3>Confusion Matrix</h3>

            <ConfusionMatrix
              matrix={result.confusion_matrix}
              labels={result.class_labels}
            />
          </div>
        </div>
      )}
    </section>
  );
}
