from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
import logging
from ocr import (
    process_uploaded_pdf,
    get_document_info,
    extract_pdf_text
)
from document_processing import (
    upload_and_process_document
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase app
initialize_app()

@https_fn.on_call()
def simple_predict_grade(req: https_fn.CallableRequest) -> dict:
    """
    Simplified prediction function that works with available documents.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    try:
        logger.info(f"Starting grade prediction for user {user_id}")
        
        # Get all documents for the user
        db = firestore.client()
        docs = {}
        
        # Try to get syllabus and transcript
        doc_types = ["syllabus", "transcript"]
        for doc_type in doc_types:
            doc_ref = db.collection("users").document(user_id).collection("documents").document(doc_type)
            doc = doc_ref.get()
            
            if doc.exists:
                doc_data = doc.to_dict()
                text = doc_data.get("text", "")
                
                # If text is not extracted yet, try to extract it
                if not text and doc_data.get("filePath"):
                    logger.info(f"Text not found for {doc_type}, attempting extraction")
                    try:
                        # Call extract_pdf_text directly
                        from ocr import extract_pdf_text
                        result = extract_pdf_text({
                            "auth": {"uid": user_id},
                            "data": {"documentType": doc_type}
                        })
                        
                        # Refresh the document to get the extracted text
                        doc = doc_ref.get()
                        doc_data = doc.to_dict()
                        text = doc_data.get("text", "")
                    except Exception as e:
                        logger.error(f"Error extracting text: {str(e)}")
                
                if text:
                    docs[doc_type] = text
                    logger.info(f"Found {len(text)} characters of text for {doc_type}")
        
        if not docs:
            logger.warning("No document text found for prediction")
            return {
                "success": False,
                "message": "No document text found. Please upload at least a syllabus or transcript."
            }
        
        logger.info("Generating prediction based on available documents")
        
        # Simple placeholder prediction - replace with your actual prediction logic
        prediction = {
            "predictedGrade": "B+",
            "confidence": 0.78,
            "factors": [
                "Based on available document content",
                "Grade weights in syllabus suggest moderate difficulty",
                "Current document analysis indicates good performance likelihood"
            ]
        }
        
        # Store prediction in Firestore
        prediction_ref = db.collection("users").document(user_id).collection("predictions").document()
        prediction_data = {
            "prediction": prediction,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "documents": {k: "..." for k in docs.keys()}  # Don't store full text
        }
        prediction_ref.set(prediction_data)
        
        logger.info("Grade prediction completed successfully")
        
        return {
            "success": True,
            "prediction": prediction,
            "message": "Grade prediction completed successfully"
        }
    
    except Exception as e:
        logger.error(f"Error predicting grade: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error predicting grade: {str(e)}"
        )


# Re-export all functions
__all__ = [
    # OCR functions
    'process_uploaded_pdf',
    'get_document_info',
    'extract_pdf_text',
    # Prediction functions
    'simple_predict_grade',
    # Document processing functions
    'upload_and_process_document'
]
