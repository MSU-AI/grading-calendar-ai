from firebase_functions import https_fn
from firebase_admin import initialize_app
from auth import (
    create_user_profile,
    delete_user_data,
    get_user_profile,
    update_user_profile
)
from ocr import (
    extract_text_from_pdf,
    process_syllabus,
    process_transcript,
    process_uploaded_pdf
)
from openai_api import (
    analyze_grades,
    predict_final_grade,
    extract_assignments
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

# Re-export all functions
__all__ = [
    # Auth functions
    'create_user_profile',
    'delete_user_data',
    'get_user_profile',
    'update_user_profile',
    # OCR functions
    'extract_text_from_pdf',
    'process_syllabus',
    'process_transcript',
    'process_uploaded_pdf',
    # OpenAI API functions
    'analyze_grades',
    'predict_final_grade',
    'extract_assignments',
    # Storage functions
    'get_upload_url',
    # Document processing functions
    'upload_and_process_document',
    'get_document_status',
    'get_user_documents'
]
