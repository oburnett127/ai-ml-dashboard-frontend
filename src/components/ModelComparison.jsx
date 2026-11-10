
import { useEffect, useRef, useState } from "react";
import "./ModelComparison.css";

const COMPARISON_URL = "/api/models/compare";

const METRICS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1_score", label: "F1 Score" },
];

function formatPercentage(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function isValidMetric(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isValidResponse(data) {
  return (
    data &&
    typeof data.best_model === "string" &&
    Array.isArray(data.models) &&
    data.models.length > 0 &&
    data.models.every(
      (model) =>
        typeof model.name === "string" &&
        METRICS.every(({ key }) =>
          isValidMetric(model.cv_metrics?.[key])
        ) &&
        isValidMetric(model.cv_f1_std) &&
        Array.isArray(model.cv_f1_scores) &&
        model.cv_f1_scores.every(isValidMetric)
    ) &&
    METRICS.every(({ key }) =>
      isValidMetric(data.best_model_test_metrics?.[key])
    ) &&
    Array.isArray(data.best_model_confusion_matrix) &&
    data.best_model_confusion_matrix.length === 2 &&
    data.best_model_confusion_matrix.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 2 &&
        row.every(
          (value) => Number.isInteger(value) && value >= 0
        )
    ) &&
    Array.isArray(data.class_labels) &&
    data.class_labels.length === 2
  );
}

function ComparisonChart({ models }) {
  return (
    <div className="comparison-chart">
      {models.map((model) => (
        <div className="comparison-chart-item" key={model.name}>
          <div className="comparison-chart-label">
            <span>{model.name}</span>
            <strong>
              {formatPercentage(model.cv_metrics.f1_score)}
            </strong>
          </div>

          <progress
            className="comparison-progress"
            value={model.cv_metrics.f1_score}
            max="1"
            aria-label={`${model.name} cross-validation F1 score`}
          />
        </div>
      ))}
    </div>
  );
}

function ComparisonTable({ models, bestModel }) {
  return (
    <div className="comparison-table-wrapper">
      <table className="comparison-table">
        <caption>
          Mean cross-validation scores across five folds
        </caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Accuracy</th>
            <th scope="col">Precision</th>
            <th scope="col">Recall</th>
            <th scope="col">F1 Score</th>
            <th scope="col">F1 Std. Dev.</th>
          </tr>
        </thead>

        <tbody>
          {models.map((model) => (
            <tr key={model.name}>
              <th scope="row">
                {model.name}
                {model.name === bestModel && (
                  <span className="comparison-best-label">
                    Selected
                  </span>
                )}
              </th>

              {METRICS.map(({ key }) => (
                <td key={key}>
                  {formatPercentage(model.cv_metrics[key])}
                </td>
              ))}

              <td>{formatPercentage(model.cv_f1_std)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestMetrics({ metrics }) {
  return (
    <div className="comparison-test-metrics">
      {METRICS.map(({ key, label }) => (
        <div className="comparison-metric-card" key={key}>
          <span>{label}</span>
          <strong>{formatPercentage(metrics[key])}</strong>
        </div>
      ))}
    </div>
  );
}

function ConfusionMatrix({ matrix, labels }) {
  return (
    <div className="comparison-table-wrapper">
      <table className="comparison-matrix">
        <caption>
          Held-out test confusion matrix. Rows are actual
          classes; columns are predicted classes.
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
                      ? "comparison-correct"
                      : "comparison-incorrect"
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

export default function ModelComparison() {
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const controllerRef = useRef(null);
  const comparingRef = useRef(false);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  async function handleCompare() {
    if (comparingRef.current) {
      return;
    }

    comparingRef.current = true;

    const controller = new AbortController();
    controllerRef.current = controller;

    setComparing(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch(COMPARISON_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Model comparison failed (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      if (!isValidResponse(data)) {
        throw new Error(
          "The backend returned an invalid comparison result."
        );
      }

      if (!controller.signal.aborted) {
        setResult(data);
      }
    } catch (err) {
      if (err.name !== "AbortError" && !controller.signal.aborted) {
        setError(err.message || "Unable to compare models.");
      }
    } finally {
      if (!controller.signal.aborted) {
        comparingRef.current = false;
        controllerRef.current = null;
        setComparing(false);
      }
    }
  }

  return (
    <section
      className="model-comparison"
      aria-labelledby="comparison-title"
    >
      <header className="comparison-header">
        <h2 id="comparison-title">Model Comparison</h2>
        <p>
          Compare Logistic Regression, Decision Tree,
          Random Forest, and Gradient Boosting using
          stratified cross-validation.
        </p>
      </header>

      <button
        type="button"
        className="comparison-button"
        onClick={handleCompare}
        disabled={comparing}
      >
        {comparing ? "Comparing Models..." : "Compare Models"}
      </button>

      {comparing && (
        <p role="status" className="comparison-status">
          Training and evaluating four algorithms.
          This may take several seconds.
        </p>
      )}

      {error && (
        <p role="alert" className="comparison-error">
          {error}
        </p>
      )}

      {result && (
        <div className="comparison-results">
          <div className="comparison-summary">
            <h3>Comparison Results</h3>

            <p>
              <strong>Dataset:</strong> {result.dataset}
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
              <strong>Cross-validation folds:</strong>{" "}
              {result.cv_folds}
            </p>
            <p>
              <strong>Selection metric:</strong> F1 Score
              (positive class: {result.positive_class})
            </p>
          </div>

          <section className="comparison-section">
            <h3>Cross-Validation F1 Scores</h3>
            <ComparisonChart models={result.models} />
          </section>

          <section className="comparison-section">
            <h3>Model Performance</h3>
            <ComparisonTable
              models={result.models}
              bestModel={result.best_model}
            />
          </section>

          <section className="comparison-section">
            <div className="comparison-winner">
              <span>Selected Model</span>
              <strong>{result.best_model}</strong>
              <p>
                Selected using the highest average
                cross-validation F1 score.
              </p>
            </div>
          </section>

          <section className="comparison-section">
            <h3>Selected Model — Held-Out Test Results</h3>
            <p className="comparison-help">
              These scores were calculated on the untouched
              test set after model selection.
            </p>

            <TestMetrics
              metrics={result.best_model_test_metrics}
            />
          </section>

          <section className="comparison-section">
            <h3>Selected Model — Confusion Matrix</h3>
            <ConfusionMatrix
              matrix={result.best_model_confusion_matrix}
              labels={result.class_labels}
            />
          </section>
        </div>
      )}
    </section>
  );
}
