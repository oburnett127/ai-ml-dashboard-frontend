
import DatasetExplorer from "./components/DatasetExplorer";
import ModelTraining from "./components/ModelTraining";
import "./App.css";

export default function App() {
  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>AI-Assisted ML Dashboard</h1>

        <p>
          Explore datasets, train models, and evaluate
          machine learning performance.
        </p>
      </header>

      <DatasetExplorer />

      <ModelTraining />
    </main>
  );
}
