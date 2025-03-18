import os
import tempfile
import logging
from google.cloud import vision
from firebase_admin import storage

logging.basicConfig(level=logging.INFO)

def extract_text_from_pdf(file_path):
    """
    Extract text from a PDF stored in Firebase Storage using Google Cloud Vision API.
    Returns the extracted text as a string.
    """
    try:
        # Get the bucket
        bucket = storage.bucket()
        
        # Get the PDF from Firebase Storage
        blob = bucket.blob(file_path)
        
        # Download to a temporary file
        _, temp_local_filename = tempfile.mkstemp(suffix=".pdf")
        blob.download_to_filename(temp_local_filename)
        
        logging.info(f"Downloaded PDF to {temp_local_filename}")
        
        # Set up Vision API client
        vision_client = vision.ImageAnnotatorClient()
        
        # Read the PDF file
        with open(temp_local_filename, "rb") as pdf_file:
            content = pdf_file.read()
        
        # Configure input
        input_config = vision.InputConfig(
            content=content,
            mime_type="application/pdf"
        )
        
        # Configure feature
        feature = vision.Feature(
            type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION
        )
        
        # Configure output
        output_config = vision.OutputConfig(
            batch_size=1  # Process one page at a time
        )
        
        # Create request
        request = vision.AsyncAnnotateFileRequest(
            features=[feature],
            input_config=input_config,
            output_config=output_config
        )
        
        logging.info("Sending request to Vision API...")
        
        # Make the request
        operation = vision_client.async_batch_annotate_files(requests=[request])
        result = operation.result(timeout=180)  # Wait up to 3 minutes
        
        logging.info("Vision API request completed")
        
        # Extract text from all pages
        full_text = ""
        for response in result.responses:
            for page in response.pages:
                full_text += page.full_text_annotation.text + "\n"
        
        # Clean up
        os.remove(temp_local_filename)
        
        logging.info(f"Extracted {len(full_text)} characters from PDF")
        return full_text
    
    except Exception as e:
        logging.error(f"Error extracting text from PDF: {str(e)}")
        raise e
