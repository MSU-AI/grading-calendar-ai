from firebase_functions import https_fn
from firebase_admin import firestore
import google.cloud.firestore

@https_fn.on_call()
def extract_text_from_pdf(req: https_fn.CallableRequest) -> dict:
    """
    Callable function to extract text from PDF using OCR.
    """
    # Placeholder function - will be implemented later
    return {"success": True, "message": "OCR function placeholder"}

@https_fn.on_call()
def process_syllabus(req: https_fn.CallableRequest) -> dict:
    """
    Process syllabus PDF to extract course information.
    """
    # Placeholder function - will be implemented later
    return {"success": True, "message": "Syllabus processing placeholder"}

@https_fn.on_call()
def process_transcript(req: https_fn.CallableRequest) -> dict:
    """
    Process transcript PDF to extract grade information.
    """
    # Placeholder function - will be implemented later
    return {"success": True, "message": "Transcript processing placeholder"}
