from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
from auth import (
    create_user_profile,
    delete_user_data,
    get_user_profile,
    update_user_profile
)
from ocr import (
    process_uploaded_pdf,
    get_document_info,
    extract_pdf_text
)
from storage import (
    get_upload_url
)
from document_processing import (
    upload_and_process_document,
    get_document_status,
    get_user_documents
)

# Initialize Firebase app
initialize_app()

@https_fn.on_call()
def predict_grade(req: https_fn.CallableRequest) -> dict:
    """
    Predict final grade based on syllabus, transcript, and grades data.
    This function is called after text extraction is complete.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    try:
        # Get all documents for the user
        db = firestore.client()
        docs = {}
        for doc_type in ["syllabus", "transcript", "grades"]:
            doc_ref = db.collection("users").document(user_id).collection("documents").document(doc_type)
            doc = doc_ref.get()
            
            if not doc.exists:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.NOT_FOUND,
                    message=f"{doc_type} document not found"
                )
            
            doc_data = doc.to_dict()
            if not doc_data.get("text"):
                # Extract text if not already extracted
                extract_pdf_text({
                    "auth": {"uid": user_id},
                    "data": {"documentType": doc_type}
                })
                doc = doc_ref.get()  # Get updated document
                doc_data = doc.to_dict()
            
            docs[doc_type] = doc_data.get("text", "")
        
        # TODO: Implement actual prediction logic here
        # For now, just return a placeholder prediction
        prediction = {
            "predictedGrade": "A",
            "confidence": 0.85,
            "factors": [
                "Strong previous performance in similar courses",
                "Consistent attendance",
                "High engagement in class activities"
            ]
        }
        
        # Store prediction in Firestore
        prediction_ref = db.collection("users").document(user_id).collection("predictions").document()
        prediction_data = {
            "prediction": prediction,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "documents": {
                "syllabus": docs["syllabus"],
                "transcript": docs["transcript"],
                "grades": docs["grades"]
            }
        }
        prediction_ref.set(prediction_data)
        
        return {
            "success": True,
            "prediction": prediction,
            "message": "Grade prediction completed successfully"
        }
    
    except Exception as e:
        print(f"Error predicting grade: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error predicting grade: {str(e)}"
        )

# Re-export all functions
__all__ = [
    # Auth functions
    'create_user_profile',
    'delete_user_data',
    'get_user_profile',
    'update_user_profile',
    # PDF upload and processing functions
    'process_uploaded_pdf',
    'get_document_info',
    'extract_pdf_text',
    'predict_grade',
    # Storage functions
    'get_upload_url',
    # Document processing functions
    'upload_and_process_document',
    'get_document_status',
    'get_user_documents'
]
