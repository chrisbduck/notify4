from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/api/test1", methods=["GET"])
def test_endpoint_1():
    """First test endpoint"""
    return jsonify({
        "status": "success",
        "message": "Test endpoint 1 is working!",
        "data": {
            "test": "endpoint1",
            "timestamp": "2026-02-22T12:34:56Z"
        }
    })


@app.route("/api/test2", methods=["GET"])
def test_endpoint_2():
    """Second test endpoint"""
    return jsonify({
        "status": "success",
        "message": "Test endpoint 2 is working!",
        "data": {
            "test": "endpoint2",
            "count": 42,
            "items": ["apple", "banana", "orange", "grape"]
        }
    })


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
