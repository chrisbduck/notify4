import { useState, FC } from 'react'
import './App.css'

interface ApiResponse {
    status: string
    message: string
    data: Record<string, unknown>
}

const App: FC = () => {
    const [test1Result, setTest1Result] = useState<ApiResponse | null>(null)
    const [test2Result, setTest2Result] = useState<ApiResponse | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

    const callEndpoint = async (endpoint: string, setResult: (data: ApiResponse) => void): Promise<void> => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/${endpoint}`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data: ApiResponse = await response.json()
            setResult(data)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            setError(`Failed to call ${endpoint}: ${errorMessage}`)
        } finally {
            setLoading(false)
        }
    }

    const handleCallTest1 = () => callEndpoint('test1', setTest1Result)
    const handleCallTest2 = () => callEndpoint('test2', setTest2Result)

    return (
        <div className="container">
            <h1>Notify4 - Backend Test</h1>
            <p className="subtitle">Testing Flask API endpoints from React (TypeScript)</p>

            <div className="button-group">
                <button onClick={handleCallTest1} disabled={loading}>
                    Call Test Endpoint 1
                </button>
                <button onClick={handleCallTest2} disabled={loading}>
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
    )
}

export default App
