from firebase_functions import https_fn
from firebase_admin import firestore
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@https_fn.on_call()
def get_document_info(req: https_fn.CallableRequest) -> dict:
    """
    Get information about an uploaded document.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    document_type = req.data.get("documentType")
    if not document_type:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Document type is required"
        )
    
    user_id = req.auth.uid
    
    # Get document info from Firestore
    db = firestore.client()
    doc_ref = db.collection("users").document(user_id).collection("documents").document(document_type)
    doc = doc_ref.get()
    
    if doc.exists:
        doc_data = doc.to_dict()
        return {"success": True, "data": doc_data}
    
    return {
        "success": False,
        "message": "Document not found"
    }
