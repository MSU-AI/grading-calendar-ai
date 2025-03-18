from firebase_functions import https_fn
from firebase_admin import firestore
import google.cloud.firestore
import openai
import os
import json

# Initialize OpenAI client
openai.api_key = os.environ.get("OPENAI_API_KEY")

def construct_prompt(course_data):
    """
    Construct a concise prompt using the JSON format:
      course_name, instructor, grade_weights, assignments,
      gpa, final_grade, due_dates, credit_hours.
    """
    prompt_lines = []
    
    # Basic information
    prompt_lines.append(f"Course Name: {course_data['course_name']}")
    prompt_lines.append(f"Instructor: {course_data['instructor']}")
    
    # Grade weights
    prompt_lines.append("Grade Weights:")
    for gw in course_data["grade_weights"]:
        prompt_lines.append(f"  - {gw['name']}: {gw['weight']}")
    
    # Assignments
    assignments_str = ", ".join(course_data["assignments"])
    prompt_lines.append(f"Assignments: {assignments_str}")
    
    # GPA, final grade, and credit hours
    prompt_lines.append(f"GPA: {course_data['gpa']}")
    prompt_lines.append(f"Current/Previous Final Grade: {course_data['final_grade']}")
    prompt_lines.append(f"Credit Hours: {course_data['credit_hours']}")
    
    # Due dates
    prompt_lines.append("Due Dates:")
    for dd in course_data["due_dates"]:
        prompt_lines.append(f"  - {dd['assignment']} due on {dd['due_date']}")
    
    # Final instruction
    prompt_lines.append(
        "Based on these details, predict the student's final grade. "
        "Output exactly in JSON format with two keys: 'grade' (a numeric value) "
        "and 'reasoning' (a short explanation). Do not include extra text."
    )
    
    return "\n".join(prompt_lines)

def get_chatgpt_prediction(prompt):
    """Call the OpenAI API to get a prediction."""
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a concise academic advisor."},
            {"role": "user", "content": prompt}
        ]
    )
    return response["choices"][0]["message"]["content"]

@https_fn.on_call()
def analyze_grades(req: https_fn.CallableRequest) -> dict:
    """
    Analyze extracted grade data using OpenAI API.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get course data from request
    course_data = req.data.get("courseData")
    if not course_data:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Course data is required"
        )
    
    # Analyze grades
    try:
        # Use OpenAI to analyze grades
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an academic advisor analyzing grade data."},
                {"role": "user", "content": f"Analyze this grade data and provide insights: {json.dumps(course_data)}"}
            ]
        )
        
        analysis = response["choices"][0]["message"]["content"]
        
        # Store analysis in Firestore
        db = firestore.client()
        analysis_ref = db.collection("users").document(user_id).collection("analyses").document()
        
        analysis_data = {
            "courseData": course_data,
            "analysis": analysis,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "type": "grade_analysis"
        }
        
        analysis_ref.set(analysis_data)
        
        return {
            "success": True, 
            "analysisId": analysis_ref.id,
            "analysis": analysis
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error analyzing grades: {str(e)}"
        )

@https_fn.on_call()
def predict_final_grade(req: https_fn.CallableRequest) -> dict:
    """
    Predict final grade based on current grades and weights.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get course data from request
    course_data = req.data.get("courseData")
    if not course_data:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Course data is required"
        )
    
    # Validate course data
    required_fields = ["course_name", "instructor", "grade_weights", 
                      "assignments", "gpa", "final_grade", "due_dates", "credit_hours"]
    for field in required_fields:
        if field not in course_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"Missing required field: {field}"
            )
    
    # Predict final grade
    try:
        # Construct prompt
        prompt = construct_prompt(course_data)
        
        # Get prediction from ChatGPT
        prediction_text = get_chatgpt_prediction(prompt)
        
        # Parse prediction
        try:
            prediction = json.loads(prediction_text)
        except json.JSONDecodeError:
            # If not valid JSON, return raw text
            prediction = {"grade": 0, "reasoning": prediction_text}
        
        # Store prediction in Firestore
        db = firestore.client()
        prediction_ref = db.collection("users").document(user_id).collection("predictions").document()
        
        prediction_data = {
            "courseData": course_data,
            "prediction": prediction,
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        
        prediction_ref.set(prediction_data)
        
        return {
            "success": True,
            "predictionId": prediction_ref.id,
            "prediction": prediction
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error predicting final grade: {str(e)}"
        )

@https_fn.on_call()
def extract_assignments(req: https_fn.CallableRequest) -> dict:
    """
    Extract upcoming assignments and exams from syllabus.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get syllabus text from Firestore
    db = firestore.client()
    doc_ref = db.collection("users").document(user_id).collection("documents").document("syllabus")
    doc = doc_ref.get()
    
    if not doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Syllabus not found"
        )
    
    # Extract assignments
    try:
        text = doc.to_dict().get("text", "")
        
        # Use OpenAI to extract assignments
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": 
                 """Extract assignments and due dates from this syllabus.
                 Return the data in this JSON format:
                 {
                    "assignments": [
                        {"name": "...", "due_date": "...", "type": "..."}
                    ]
                 }
                 """},
                {"role": "user", "content": text}
            ]
        )
        
        assignments_text = response["choices"][0]["message"]["content"]
        
        # Parse the response
        try:
            assignments_data = json.loads(assignments_text)
        except json.JSONDecodeError:
            # If not valid JSON, return raw text
            assignments_data = {"assignments": [], "raw_text": assignments_text}
        
        # Store assignments in Firestore
        assignments_ref = db.collection("users").document(user_id).collection("assignments").document()
        
        assignments_doc = {
            "data": assignments_data,
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        
        assignments_ref.set(assignments_doc)
        
        return {
            "success": True,
            "assignmentsId": assignments_ref.id,
            "assignments": assignments_data
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error extracting assignments: {str(e)}"
        )
