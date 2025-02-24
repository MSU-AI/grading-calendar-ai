import json
import openai
import os

def load_data(json_file_path):
    """Load student data from a JSON file."""
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    return data

def construct_prompt(student_data):
    """
    Construct a concise prompt using student details.
    The prompt instructs ChatGPT to output a JSON object with two keys: "grade" and "reasoning".
    """
    prompt = (
        f"Student details:\n"
        f"- Grades: {student_data['previous_grades']}\n"
        f"- GPA: {student_data['transcript']['GPA']}\n"
        f"- Assignment weight: {student_data['syllabus_info']['assignment_weight']}\n"
        f"- Exam weight: {student_data['syllabus_info']['exam_weight']}\n\n"
        "Based on these details, predict the student's final grade. "
        "Output exactly in JSON format with two keys: 'grade' (a numeric value) and "
        "'reasoning' (a short explanation). Do not include any extra text."
    )
    return prompt

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

def main():
    # Set your OpenAI API key from environment variable
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        raise ValueError("Please set your OPENAI_API_KEY environment variable.")
    
    # Load sample JSON data. Adjust path if needed.
    data = load_data("sample_data.json")
    
    # Use the first student's data as an example.
    student = data["students"][0]
    
    # Construct the prompt.
    prompt = construct_prompt(student)
    
    # Get the prediction from ChatGPT.
    prediction = get_chatgpt_prediction(prompt)
    
    print("ChatGPT's Output:")
    try:
        # Attempt to parse the JSON output to confirm format consistency.
        output = json.loads(prediction)
        print(json.dumps(output, indent=2))
    except json.JSONDecodeError:
        # In case the output is not valid JSON.
        print("Failed to parse JSON. Raw output:")
        print(prediction)

if __name__ == "__main__":
    main()
