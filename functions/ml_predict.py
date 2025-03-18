from firebase_functions import https_fn
from firebase_admin import firestore
import google.cloud.firestore
import numpy as np
from sklearn.linear_model import LinearRegression
import json
import os

@https_fn.on_call()
def predict_with_linear_regression(req: https_fn.CallableRequest) -> dict:
    """
    Predict final grade using Linear Regression model.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    user_id = req.auth.uid
    
    # Get student data from request
    student_data = req.data.get("studentData")
    if not student_data:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Student data is required"
        )
    
    # Validate student data
    required_fields = ["previous_grades", "transcript", "syllabus_info"]
    for field in required_fields:
        if field not in student_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"Missing required field: {field}"
            )
    
    # Get training data from Firestore
    db = firestore.client()
    training_data_ref = db.collection("training_data").document("students")
    training_data_doc = training_data_ref.get()
    
    if not training_data_doc.exists:
        # If no training data exists, create it from sample data
        try:
            # Create sample training data
            sample_data = {
                "students": [
                    {
                        "id": 1,
                        "previous_grades": [85, 90, 92],
                        "transcript": {
                            "GPA": 3.6
                        },
                        "syllabus_info": {
                            "assignment_weight": 0.3,
                            "exam_weight": 0.7
                        },
                        "final_grade": 90
                    },
                    {
                        "id": 2,
                        "previous_grades": [70, 75, 78],
                        "transcript": {
                            "GPA": 2.8
                        },
                        "syllabus_info": {
                            "assignment_weight": 0.5,
                            "exam_weight": 0.5
                        },
                        "final_grade": 80
                    },
                    {
                        "id": 3,
                        "previous_grades": [88, 90, 85],
                        "transcript": {
                            "GPA": 3.5
                        },
                        "syllabus_info": {
                            "assignment_weight": 0.4,
                            "exam_weight": 0.6
                        },
                        "final_grade": 88
                    }
                ]
            }
            
            # Save sample data to Firestore
            training_data_ref.set(sample_data)
            training_data = sample_data
        except Exception as e:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"Error creating training data: {str(e)}"
            )
    else:
        training_data = training_data_doc.to_dict()
    
    # Train model and predict
    try:
        # Extract features and labels from training data
        X = []  # will hold feature vectors
        y = []  # will hold final grades (labels)
        
        for student in training_data["students"]:
            previous_grades = student["previous_grades"]
            gpa = student["transcript"]["GPA"]
            assignment_weight = student["syllabus_info"]["assignment_weight"]
            exam_weight = student["syllabus_info"]["exam_weight"]
            final_grade = student["final_grade"]
            
            # Example of simple feature engineering:
            avg_previous_grade = sum(previous_grades) / len(previous_grades)
            
            # Build feature vector
            features = [
                avg_previous_grade,
                gpa,
                assignment_weight,
                exam_weight
            ]
            
            X.append(features)
            y.append(final_grade)
        
        # Convert to numpy arrays
        X = np.array(X)
        y = np.array(y)
        
        # Train model
        model = LinearRegression()
        model.fit(X, y)
        
        # Prepare features for prediction
        previous_grades = student_data["previous_grades"]
        gpa = student_data["transcript"]["GPA"]
        assignment_weight = student_data["syllabus_info"]["assignment_weight"]
        exam_weight = student_data["syllabus_info"]["exam_weight"]
        
        avg_previous_grade = sum(previous_grades) / len(previous_grades)
        
        features = np.array([[
            avg_previous_grade,
            gpa,
            assignment_weight,
            exam_weight
        ]])
        
        # Make prediction
        predicted_grade = model.predict(features)[0]
        
        # Store prediction in Firestore
        prediction_ref = db.collection("users").document(user_id).collection("ml_predictions").document()
        
        prediction_data = {
            "studentData": student_data,
            "prediction": {
                "grade": float(predicted_grade),
                "model": "linear_regression"
            },
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        
        prediction_ref.set(prediction_data)
        
        return {
            "success": True,
            "predictionId": prediction_ref.id,
            "prediction": {
                "grade": float(predicted_grade),
                "model": "linear_regression"
            }
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error predicting with linear regression: {str(e)}"
        )

@https_fn.on_call()
def add_training_data(req: https_fn.CallableRequest) -> dict:
    """
    Add new training data for the linear regression model.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )
    
    # Get student data from request
    student_data = req.data.get("studentData")
    if not student_data:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Student data is required"
        )
    
    # Validate student data
    required_fields = ["previous_grades", "transcript", "syllabus_info", "final_grade"]
    for field in required_fields:
        if field not in student_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"Missing required field: {field}"
            )
    
    # Add to training data in Firestore
    try:
        db = firestore.client()
        training_data_ref = db.collection("training_data").document("students")
        
        # Get existing training data
        training_data_doc = training_data_ref.get()
        
        if training_data_doc.exists:
            training_data = training_data_doc.to_dict()
            
            # Generate new ID
            max_id = 0
            for student in training_data["students"]:
                if student["id"] > max_id:
                    max_id = student["id"]
            
            # Add new student data with ID
            student_data["id"] = max_id + 1
            training_data["students"].append(student_data)
            
            # Update training data
            training_data_ref.set(training_data)
        else:
            # Create new training data
            training_data = {
                "students": [
                    {
                        "id": 1,
                        **student_data
                    }
                ]
            }
            
            # Save to Firestore
            training_data_ref.set(training_data)
        
        return {
            "success": True,
            "message": "Training data added successfully"
        }
    
    except Exception as e:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Error adding training data: {str(e)}"
        )
