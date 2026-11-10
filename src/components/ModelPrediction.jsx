
import { useCallback, useEffect, useRef, useState } from "react";
import "./ModelPrediction.css";

const SAVE_URL = "/api/models/save-best";
const SAVED_URL = "/api/models/saved";
const PREDICT_URL = "/api/models/predict";
const DATASET_URL = "/api/datasets/breast-cancer";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const error = new Error("No saved model exists yet.");
      error.status = 404;
      throw error;
    }

    throw new Error(
      `Request failed (HTTP ${response.status}).`
    );
  }

  return response.json();
}

function validateModelInfo(data) {
  if (
    !data ||
    typeof data.model_name !== "string" ||
    !Array.isArray(data.feature_names) ||
    data.feature_names.length !== 30 ||
    new Set(data.feature_names).size !== 30 ||
    !data.feature_names.every(
      (name) => typeof name === "string"
    )
  ) {
    throw new Error("Invalid saved model information.");
  }

  return data;
}

function validatePrediction(data) {
  if (
    !data ||
    typeof data.predicted_label !== "string" ||
    !Array.isArray(data.probabilities) ||
    data.probabilities.length !== 2 ||
    !data.probabilities.every(
      (item) =>
        typeof item.label === "string" &&
        typeof item.probability === "number" &&
        Number.isFinite(item.probability) &&
        item.probability >= 0 &&
        item.probability <= 1
    )
  ) {
    throw new Error("Invalid prediction response.");
  }

  return data;
}

function ProbabilityBar({ label, probability }) {
  return (
    <div className="prediction-probability-item">
      <div className="prediction-probability-label">
        <span>{label}</span>
        <strong>
          {(probability * 100).toFixed(2)}%
        </strong>
      </div>

      <progress
        className="prediction-progress"
        value={probability}
        max="1"
        aria-label={`${label} estimated probability`}
      />
    </div>
  );
}

export default function ModelPrediction() {
  const [model, setModel] = useState(null);
  const [values, setValues] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState("");

  const controllerRef = useRef(null);
  const actionRef = useRef(false);

  const loadSavedModel = useCallback(async (signal) => {
    try {
      const data = await requestJson(SAVED_URL, {
        signal,
      });

      if (!signal.aborted) {
        setModel(validateModelInfo(data));
      }
    } catch (err) {
      if (signal.aborted) {
        return;
      }

      if (err.status === 404) {
        setModel(null);
        return;
      }

      throw err;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    async function initialize() {
      try {
        await loadSavedModel(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => controller.abort();
  }, [loadSavedModel]);

  async function handleSave() {
    if (actionRef.current) {
      return;
    }

    actionRef.current = true;
    setSaving(true);
    setError("");
    setPrediction(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      await requestJson(SAVE_URL, {
        method: "POST",
        signal: controller.signal,
      });

      await loadSavedModel(controller.signal);

      if (!controller.signal.aborted) {
        setValues({});
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "Unable to save model.");
      }
    } finally {
      actionRef.current = false;

      if (!controller.signal.aborted) {
        setSaving(false);
      }
    }
  }

  async function handleLoadExample() {
    if (!model || actionRef.current) {
      return;
    }

    actionRef.current = true;
    setLoadingExample(true);
    setError("");
    setPrediction(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const data = await requestJson(DATASET_URL, {
        signal: controller.signal,
      });

      const example = data.preview?.[0];

      if (!example) {
        throw new Error("No example record available.");
      }

      const nextValues = {};

      for (const name of model.feature_names) {
        const value = example[name];

        if (
          typeof value !== "number" ||
          !Number.isFinite(value)
        ) {
          throw new Error(
            `Invalid example value for ${name}.`
          );
        }

        nextValues[name] = String(value);
      }

      if (!controller.signal.aborted) {
        setValues(nextValues);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "Unable to load example.");
      }
    } finally {
      actionRef.current = false;

      if (!controller.signal.aborted) {
        setLoadingExample(false);
      }
    }
  }

  function updateFeature(name, value) {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setPrediction(null);
  }

  async function handlePredict(event) {
    event.preventDefault();

    if (!model || actionRef.current) {
      return;
    }

    const features = {};

    for (const name of model.feature_names) {
      const raw = values[name];

      if (
        typeof raw !== "string" ||
        raw.trim() === ""
      ) {
        setError(`Please enter a value for ${name}.`);
        return;
      }

      const number = Number(raw);

      if (!Number.isFinite(number)) {
        setError(`Invalid number for ${name}.`);
        return;
      }

      features[name] = number;
    }

    actionRef.current = true;
    setPredicting(true);
    setError("");
    setPrediction(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const result = await requestJson(PREDICT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ features }),
      });

      if (!controller.signal.aborted) {
        setPrediction(validatePrediction(result));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "Prediction failed.");
      }
    } finally {
      actionRef.current = false;

      if (!controller.signal.aborted) {
        setPredicting(false);
      }
    }
  }

  const busy = saving || predicting || loadingExample;

  return (
    <section
      className="model-prediction"
      aria-labelledby="prediction-title"
    >
      <header className="prediction-header">
        <h2 id="prediction-title">Model Predictions</h2>
        <p>
          Save your selected model and use it to classify
          new samples.
        </p>
      </header>

      {loading ? (
        <p role="status">Checking saved model...</p>
      ) : (
        <>
          <div className="prediction-model-panel">
            {model ? (
              <>
                <p className="prediction-model-status">
                  Saved model available
                </p>
                <h3>{model.model_name}</h3>
                <p>
                  Dataset: {model.dataset}
                </p>
                <p>
                  Features: {model.feature_names.length}
                </p>
              </>
            ) : (
              <p>
                No saved model is available yet.
              </p>
            )}

            <button
              type="button"
              className="prediction-button"
              onClick={handleSave}
              disabled={busy}
            >
              {saving
                ? "Saving Model..."
                : model
                  ? "Retrain and Save Model"
                  : "Train and Save Best Model"}
            </button>
          </div>

          {model && (
            <form
              className="prediction-form"
              onSubmit={handlePredict}
            >
              <div className="prediction-form-heading">
                <h3>Enter Feature Values</h3>

                <button
                  type="button"
                  className="prediction-secondary-button"
                  onClick={handleLoadExample}
                  disabled={busy}
                >
                  {loadingExample
                    ? "Loading..."
                    : "Load Example"}
                </button>
              </div>

              <p className="prediction-help">
                Enter all 30 numerical measurements.
                Load Example fills the fields using a
                sample from the dataset.
              </p>

              <div className="prediction-fields">
                {model.feature_names.map((name) => (
                  <div
                    className="prediction-field"
                    key={name}
                  >
                    <label htmlFor={`feature-${name}`}>
                      {name}
                    </label>

                    <input
                      id={`feature-${name}`}
                      type="number"
                      step="any"
                      required
                      value={values[name] ?? ""}
                      onChange={(event) =>
                        updateFeature(
                          name,
                          event.target.value
                        )
                      }
                      disabled={busy}
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="prediction-button"
                disabled={busy}
              >
                {predicting
                  ? "Predicting..."
                  : "Make Prediction"}
              </button>
            </form>
          )}

          {error && (
            <p
              className="prediction-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {prediction && (
            <div
              className="prediction-result"
              aria-live="polite"
            >
              <h3>Prediction Result</h3>

              <p className="prediction-result-label">
                {prediction.predicted_label}
              </p>

              <p>
                Model: {prediction.model}
              </p>

              <div className="prediction-probabilities">
                {prediction.probabilities.map((item) => (
                  <ProbabilityBar
                    key={item.class_value}
                    label={item.label}
                    probability={item.probability}
                  />
                ))}
              </div>

              <p className="prediction-disclaimer">
                Educational model output only.
                Not suitable for medical diagnosis.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
