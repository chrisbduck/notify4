from flask import Flask, jsonify
from flask_cors import CORS
try:
    import logging
    import sys
except Exception as e:
    raise RuntimeError(f"Error importing logging or sys: {e}")

app = Flask(__name__)
CORS(app)

# Configure logging to stdout so logs are visible in Vercel
try:
    logger = logging.getLogger("notify4")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
        logger.addHandler(handler)
except Exception as e:
    raise RuntimeError(f"Error setting up logging: {e}")

@app.route("/api/test1", methods=["GET"])
def test_endpoint_1():
    """First test endpoint"""
    logger.info("/api/test1 called - TEST PHRASE: test-endpoint-1-phrase")
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
    logger.info("/api/test2 called - TEST PHRASE: test-endpoint-2-phrase")
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
