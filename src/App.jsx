
import DatasetExplorer from "./components/DatasetExplorer";
import ModelTraining from "./components/ModelTraining";
import ModelComparison from "./components/ModelComparison";
import ModelPrediction from "./components/ModelPrediction";
import "./App.css";

export default function App() {
  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>AI-Assisted ML Dashboard</h1>

        <p>
          Explore datasets, train models, compare algorithms,
          and make machine learning predictions.
        </p>
      </header>

      <DatasetExplorer />

      <ModelTraining />

      <ModelComparison />

      <ModelPrediction />
    </main>
  );
}
