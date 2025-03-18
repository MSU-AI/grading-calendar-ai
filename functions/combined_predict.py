from firebase_functions import https_fn
from firebase_admin import firestore
import google.cloud.firestore
import json
import os

@https_fn.on_call()
def get_combined_prediction(req: https_fn.CallableRequest) -> dict:
    """
    Get combined prediction from both ChatGPT and Linear Regression models.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get prediction IDs from request
    chatgpt_prediction_id = req.data.get("chatgptPredictionId")
    ml_prediction_id = req.data.get("mlPredictionId")
    
    if not chatgpt_prediction_id or not ml_prediction_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Both ChatGPT and ML prediction IDs are required"
        )
    
    # Get predictions from Firestore
    try:
        db = firestore.client()
        
        # Get ChatGPT prediction
        chatgpt_prediction_ref = db.collection("users").document(user_id).collection("predictions").document(chatgpt_prediction_id)
        chatgpt_prediction_doc = chatgpt_prediction_ref.get()
        
        if not chatgpt_prediction_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="ChatGPT prediction not found"
            )
        
        chatgpt_prediction = chatgpt_prediction_doc.to_dict()
        
        # Get ML prediction
        ml_prediction_ref = db.collection("users").document(user_id).collection("ml_predictions").document(ml_prediction_id)
        ml_prediction_doc = ml_prediction_ref.get()
        
        if not ml_prediction_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="ML prediction not found"
            )
        
        ml_prediction = ml_prediction_doc.to_dict()
        
        # Combine predictions
        chatgpt_grade = chatgpt_prediction["prediction"]["grade"]
        ml_grade = ml_prediction["prediction"]["grade"]
        
        # Simple average of both predictions
        combined_grade = (float(chatgpt_grade) + float(ml_grade)) / 2
        
        # Create combined prediction
        combined_prediction = {
            "grade": combined_grade,
            "chatgpt_grade": chatgpt_grade,
            "ml_grade": ml_grade,
            "reasoning": chatgpt_prediction["prediction"]["reasoning"],
            "confidence": "medium"  # Default confidence
        }
        
        # Determine confidence based on agreement between models
        grade_difference = abs(float(chatgpt_grade) - float(ml_grade))
        if grade_difference < 5:
            combined_prediction["confidence"] = "high"
        elif grade_difference > 15:
            combined_prediction["confidence"] = "low"
        
        # Store combined prediction in Firestore
        combined_ref = db.collection("users").document(user_id).collection("combined_predictions").document()
        
        combined_data = {
            "chatgptPrediction": chatgpt_prediction,
            "mlPrediction": ml_prediction,
            "combinedPrediction": combined_prediction,
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        
        combined_ref.set(combined_data)
        
        return {
            "success": True,
            "predictionId": combined_ref.id,
            "prediction": combined_prediction
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error getting combined prediction: {str(e)}"
        )

@https_fn.on_call()
def get_latest_predictions(req: https_fn.CallableRequest) -> dict:
    """
    Get the latest predictions for a user.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get predictions from Firestore
    try:
        db = firestore.client()
        
        # Get latest ChatGPT prediction
        chatgpt_predictions = db.collection("users").document(user_id).collection("predictions").order_by("createdAt", direction=firestore.Query.DESCENDING).limit(1).stream()
        chatgpt_prediction = None
        for doc in chatgpt_predictions:
            chatgpt_prediction = doc.to_dict()
            chatgpt_prediction["id"] = doc.id
            break
        
        # Get latest ML prediction
        ml_predictions = db.collection("users").document(user_id).collection("ml_predictions").order_by("createdAt", direction=firestore.Query.DESCENDING).limit(1).stream()
        ml_prediction = None
        for doc in ml_predictions:
            ml_prediction = doc.to_dict()
            ml_prediction["id"] = doc.id
            break
        
        # Get latest combined prediction
        combined_predictions = db.collection("users").document(user_id).collection("combined_predictions").order_by("createdAt", direction=firestore.Query.DESCENDING).limit(1).stream()
        combined_prediction = None
        for doc in combined_predictions:
            combined_prediction = doc.to_dict()
            combined_prediction["id"] = doc.id
            break
        
        return {
            "success": True,
            "chatgptPrediction": chatgpt_prediction,
            "mlPrediction": ml_prediction,
            "combinedPrediction": combined_prediction
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error getting latest predictions: {str(e)}"
        )
