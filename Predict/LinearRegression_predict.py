import json
import numpy as np
from sklearn.linear_model import LinearRegression

def load_data_from_json(json_file_path):
    """
    Loads student data from a JSON file.
    Returns:
       (features, labels) as numpy arrays
    """
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    
    X = []  # will hold feature vectors
    y = []  # will hold final grades (labels)
    
    for student in data["students"]:
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
    
    return np.array(X), np.array(y)

def train_model(X, y):
    """
    Trains a linear regression model on the given data.
    Returns:
        trained model
    """
    model = LinearRegression()
    model.fit(X, y)
    return model

def predict_new_student(model, new_student_data):
    """
    Takes a trained model and new student data,
    returns predicted final grade.
    """
    previous_grades = new_student_data["previous_grades"]
    gpa = new_student_data["transcript"]["GPA"]
    assignment_weight = new_student_data["syllabus_info"]["assignment_weight"]
    exam_weight = new_student_data["syllabus_info"]["exam_weight"]
    
    avg_previous_grade = sum(previous_grades) / len(previous_grades)
    
    features = np.array([[
        avg_previous_grade,
        gpa,
        assignment_weight,
        exam_weight
    ]])
    
    predicted_grade = model.predict(features)
    return predicted_grade[0]

def main():
    # 1. Load the data
    X, y = load_data_from_json("sample_data.json")
    
    # 2. Train the model
    model = train_model(X, y)
    
    # 3. Predict grade for a new (mock) student
    new_student_data = {
        "previous_grades": [88, 90, 92],
        "transcript": {
            "GPA": 3.7
        },
        "syllabus_info": {
            "assignment_weight": 0.2,
            "exam_weight": 0.8
        }
    }
    
    predicted_final_grade = predict_new_student(model, new_student_data)
    print(f"Predicted final grade: {predicted_final_grade:.2f}")

if __name__ == "__main__":
    main()
