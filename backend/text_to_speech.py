from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import tempfile
import wave
import json
import pyttsx3
from uuid import uuid4
from vosk import Model, KaldiRecognizer
import threading
import speech_recognition as sr

app = Flask(__name__)

# Enable CORS for all routes
CORS(app)

# Initialize pyttsx3 engine
try:
    engine = pyttsx3.init()
except Exception as e:
    print(f"Error initializing pyttsx3 engine: {e}")
    engine = None

# Define the folder to store the generated audio files
UPLOAD_FOLDER = './static/audio'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize VOSK model
VOSK_MODEL_PATH = "./vosk_model/vosk-model-small-en-us-0.15"

if not os.path.exists(VOSK_MODEL_PATH):
    raise Exception(f"VOSK model not found at {VOSK_MODEL_PATH}. Please download and unzip the model.")

try:
    model = Model(VOSK_MODEL_PATH)
    print("VOSK model loaded successfully!")
except Exception as e:
    print(f"Error loading VOSK model: {e}")

# Default properties for pyttsx3
DEFAULT_RATE = 150
DEFAULT_VOICE = 0  # Default to the first voice

if engine:
    engine.setProperty('rate', DEFAULT_RATE)
    voices = engine.getProperty('voices')
    engine.setProperty('voice', voices[DEFAULT_VOICE].id)

# Flag to control the assistant
assistant_active = threading.Event()  # Use threading event to manage assistant's state

# Initialize recognizer
recognizer = sr.Recognizer()

# Helper function for speech synthesis
def speak(text):
    if engine:
        engine.save_to_file(text, os.path.join(app.config['UPLOAD_FOLDER'], 'temp_speech.mp3'))
        engine.runAndWait()
    return jsonify({'message': text}), 200

# Start listening for voice commands
def listen_for_command():
    while assistant_active.is_set():  # Wait for the event to be set to True
        try:
            with sr.Microphone() as source:
                print("Listening for command...")
                audio = recognizer.listen(source)
            command = recognizer.recognize_google(audio)
            print("Command:", command)

            # Handle voice commands
            if "home" in command.lower():
                send_navigation_command("home")
            elif "about" in command.lower():
                send_navigation_command("about")
            elif "down" in command.lower():
                send_navigation_command("scroll_down")
            elif "up" in command.lower():
                send_navigation_command("scroll_up")
            elif "exit" in command.lower():
                speak("Goodbye!")
                assistant_active.clear()  # Reset the event, stopping the assistant
                break
            else:
                print("Unrecognized command:", command)

        except Exception as e:
            print(f"Error: {e}")

# Function to send navigation command to frontend
def send_navigation_command(command):
    try:
        # Here, we're sending the command through a simple HTTP request.
        # In a real-world scenario, you'd use WebSocket or Server-Sent Events (SSE) for real-time communication.
        # For now, we'll just log the commands for frontend handling.
        print(f"Navigation Command: {command}")
        # Here we would send this command to the frontend (React), for example via an API or WebSocket
    except Exception as e:
        print(f"Error sending command: {e}")

@app.route('/start-assistant', methods=['POST'])
def start_assistant():
    global assistant_active
    assistant_active.set()  # Set the event to True to indicate the assistant is active
    threading.Thread(target=listen_for_command).start()
    return jsonify({"message": "Assistant started"}), 200

@app.route('/stop-assistant', methods=['POST'])
def stop_assistant():
    global assistant_active
    assistant_active.clear()  # Clear the event, indicating the assistant is stopped
    speak("Assistant deactivated.")
    return jsonify({"message": "Assistant stopped"}), 200

# Text-to-Speech Route
@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    if not engine:
        return jsonify({'error': 'Text-to-speech engine not initialized properly'}), 500

    try:
        # Parse request data
        data = request.json
        text = data.get('text', '').strip()

        if not text:
            return jsonify({'error': 'No text provided'}), 400

        # Set up unique filename
        filename = f'{uuid4().hex}.mp3'
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        try:
            # Generate audio and save it to file
            engine.save_to_file(text, file_path)
            engine.runAndWait()
        except Exception as e:
            return jsonify({'error': f'Error saving audio file: {str(e)}'}), 500

        # Return the URL of the saved file
        audio_url = f'http://127.0.0.1:5001/static/audio/{filename}'
        return jsonify({'audioUrl': audio_url}), 200

    except Exception as e:
        return jsonify({'error': f'Error processing request: {str(e)}'}), 500

# Speech-to-Text Route
@app.route('/speech-to-text', methods=['POST'])
def speech_to_text():
    try:
        # Check if audio file is provided
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        # Save the uploaded audio file temporarily
        audio_file = request.files['audio']
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_file.write(audio_file.read())
            temp_file_path = temp_file.name

        # Open the audio file and process it with VOSK
        with wave.open(temp_file_path, "rb") as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() not in (16000, 8000):
                return jsonify({'error': 'Audio file must be WAV format with 16kHz mono audio.'}), 400

            recognizer = KaldiRecognizer(model, wf.getframerate())
            result = ""
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if recognizer.AcceptWaveform(data):
                    result = json.loads(recognizer.Result())

            # Process the final recognition result
            final_result = json.loads(recognizer.FinalResult())
            result_text = final_result.get("text", "")

        # Clean up temporary file
        os.remove(temp_file_path)

        return jsonify({'text': result_text}), 200

    except Exception as e:
        return jsonify({'error': f'Error processing audio: {str(e)}'}), 500

# Serve generated audio files
@app.route('/static/audio/<filename>')
def serve_audio(filename):
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        # Check if file exists
        if not os.path.exists(file_path):
            return jsonify({'error': f'File {filename} not found'}), 404

        # Serve the file
        response = send_from_directory(app.config['UPLOAD_FOLDER'], filename)

        # Delete the file after serving
        try:
            os.remove(file_path)
            print(f"Deleted {filename} after serving.")
        except Exception as e:
            print(f"Error deleting file {filename}: {e}")

        return response
    except Exception as e:
        return jsonify({'error': f'Error serving audio: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)  