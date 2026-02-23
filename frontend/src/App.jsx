import { useState } from "react";
import "./App.css";

function App() {
  const [test1Result, setTest1Result] = useState(null);
  const [test2Result, setTest2Result] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callTest1 = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/test1");
      const data = await response.json();
      setTest1Result(data);
    } catch (err) {
      setError(`Test 1 failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const callTest2 = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/test2");
      const data = await response.json();
      setTest2Result(data);
    } catch (err) {
      setError(`Test 2 failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Notify4 - Backend Test</h1>
      <p className="subtitle">Testing Flask API endpoints from React</p>

      <div className="button-group">
        <button onClick={callTest1} disabled={loading}>
          Call Test Endpoint 1
        </button>
        <button onClick={callTest2} disabled={loading}>
          Call Test Endpoint 2
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {test1Result && (
        <div className="result">
          <h2>Test 1 Result</h2>
          <pre>{JSON.stringify(test1Result, null, 2)}</pre>
        </div>
      )}

      {test2Result && (
        <div className="result">
          <h2>Test 2 Result</h2>
          <pre>{JSON.stringify(test2Result, null, 2)}</pre>
        </div>
      )}

      {!test1Result && !test2Result && !error && (
        <div className="placeholder">
          Click a button to call a backend endpoint
        </div>
      )}
    </div>
  );
}

export default App;
