from firebase_functions import https_fn, firestore_fn
from firebase_admin import initialize_app, firestore
import google.cloud.firestore

initialize_app()

@https_fn.on_request()
def store_numbers(req: https_fn.Request) -> https_fn.Response:
    """Store two numbers in Firestore"""
    # Get the numbers from query parameters
    num1 = req.args.get("num1")
    num2 = req.args.get("num2")
    
    # Validate input
    if not num1 or not num2:
        return https_fn.Response("Please provide both num1 and num2 as query parameters", status=400)
    
    try:
        num1 = float(num1)
        num2 = float(num2)
    except ValueError:
        return https_fn.Response("Numbers must be valid numeric values", status=400)
    
    # Store in Firestore
    firestore_client: google.cloud.firestore.Client = firestore.client()
    _, doc_ref = firestore_client.collection("number_pairs").add({
        "num1": num1,
        "num2": num2,
        "timestamp": firestore.SERVER_TIMESTAMP
    })
    
    return https_fn.Response(f"Numbers stored with ID: {doc_ref.id}")

@https_fn.on_request()
def add_latest(req: https_fn.Request) -> https_fn.Response:
    """Add the most recently stored number pair"""
    firestore_client: google.cloud.firestore.Client = firestore.client()
    
    # Get the most recent number pair
    docs = firestore_client.collection("number_pairs")\
        .order_by("timestamp", direction=firestore.Query.DESCENDING)\
        .limit(1)\
        .get()
    
    # Check if we have any documents
    if not docs:
        return https_fn.Response("No numbers found in database", status=404)
    
    # Get the first (most recent) document
    doc = docs[0]
    num1 = doc.get("num1")
    num2 = doc.get("num2")
    
    # Calculate sum
    sum_result = num1 + num2
    
    # Store the result
    doc.reference.update({
        "sum": sum_result
    })
    
    return https_fn.Response(f"Sum of {num1} and {num2} is {sum_result}")