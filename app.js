import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Main App Component
function App() {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [assistantActive, setAssistantActive] = useState(false);
  const [status, setStatus] = useState('Assistant not active');
  const [showAssistantPopup, setShowAssistantPopup] = useState(false);
  const [command, setCommand] = useState(''); // To display the recognized command

  // Speech-to-Text (Web Speech API)
  const startListening = () => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      console.error('Speech Recognition API is not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // Set the language
    recognition.continuous = false; // Stop listening once a result is received
    recognition.interimResults = false; // Don't show partial results

    recognition.onstart = () => {
      setIsListening(true);
      console.log('Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setText(transcript); // Set the recognized text into the input box
      setCommand(transcript); // Display the recognized command
      console.log('Speech recognized:', transcript);
    };

    recognition.onerror = (event) => {
      console.error('Error occurred during speech recognition:', event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('Stopped listening.');
    };

    recognition.start();
  };

  // Text-to-Speech
  const handleTextToSpeech = async () => {
    if (text.trim()) {
      try {
        const response = await axios.post('http://127.0.0.1:5001/text-to-speech', { text });
        const audio = new Audio(response.data.audioUrl);
        audio.play(); // Play the generated audio directly
      } catch (error) {
        console.error('Error generating speech:', error);
      }
    } else {
      console.warn('Text input is empty. Please type something.');
    }
  };

  // Start AKIRA Assistant
  const startAssistant = async () => {
    if (!assistantActive) {
      setAssistantActive(true);
      await fetch('http://127.0.0.1:5001/start-assistant', { method: 'POST' });
      console.log("AI Assistant started.");
      setStatus("Assistant is listening...");
      startListening(); // Start listening when the assistant starts
    }
  };

  // Stop AKIRA Assistant
  const stopAssistant = async () => {
    if (assistantActive) {
      setAssistantActive(false);
      await fetch('http://127.0.0.1:5001/stop-assistant', { method: 'POST' });
      console.log("AI Assistant stopped.");
      setStatus("Assistant stopped.");
    }
  };

  // Show/Hide Assistant Popup
  const toggleAssistantPopup = () => {
    setShowAssistantPopup(!showAssistantPopup);
  };

  // Close Popup on Outside Click
  const popupRef = useRef(null);
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setShowAssistantPopup(false); // Close the popup if click is outside
      }
    };

    // Add event listener for click outside the popup
    document.addEventListener('mousedown', handleOutsideClick);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <div className="App">
      <Header toggleAssistantPopup={toggleAssistantPopup} />
      {showAssistantPopup && (
        <AssistantPopup
          ref={popupRef} // Attach ref to popup
          text={text}
          setText={setText}
          startListening={startListening}
          handleTextToSpeech={handleTextToSpeech}
          startAssistant={startAssistant}
          stopAssistant={stopAssistant}
          isListening={isListening}
          assistantActive={assistantActive}
          status={status}
        />
      )}
      <MainContent />
      
      {/* Display the recognized command */}
      <div style={{ marginTop: '20px', fontSize: '1.2rem', color: 'white' }}>
        <h3>Command: </h3>
        <p>{command}</p> {/* Display the latest command */}
      </div>
    </div>
  );
}

// Header with AI Assistant Button
function Header({ toggleAssistantPopup }) {
  return (
    <header style={styles.header}>
      <div style={styles.logo}>EduBridgeAI</div>
      <nav style={styles.nav}>
        <a href="#" style={styles.navLink}>Home</a>
        <a href="#" style={styles.navLink}>Services</a>
        <a href="#" style={styles.navLink}>About</a>
        <a href="#" style={styles.navLink}>Contact</a>
        <button id='ai' onClick={toggleAssistantPopup} style={styles.navLink}>AI Assistant</button>
      </nav>
    </header>
  );
}

// Assistant Popup Component
function AssistantPopup({ text, setText, startListening, handleTextToSpeech, startAssistant, stopAssistant, isListening, assistantActive, status, forwardRef }) {
  const handleInputChange = (event) => {
    setText(event.target.value);
  };

  return (
    <div style={styles.popup} ref={forwardRef}>
      <div style={styles.popupContent}>
        <h2>AI Assistant</h2>
        <textarea
          value={text}
          onChange={handleInputChange}
          placeholder="Type something or use speech-to-text"
          style={styles.textarea}
        />
        <div>
          <button onClick={startListening} disabled={isListening} style={styles.button}>
            {isListening ? 'Listening...' : 'Start Speech-to-Text'}
          </button>
          <button onClick={handleTextToSpeech} style={styles.button}>Convert to Speech</button>
        </div>
        <div>
          <button onClick={startAssistant} disabled={assistantActive} style={styles.button}>
            Start AI
          </button>
          <button onClick={stopAssistant} disabled={!assistantActive} style={styles.button}>
            Stop AI
          </button>
          <p>{status}</p>
        </div>
      </div>
    </div>
  );
}

// Main Content Component (contains sections and services)
function MainContent() {
  return (
    <div style={styles.container}>
      <Section
        background="rgba(0, 0, 0, 0.6)"
        heading="Welcome to EduBridgeAI - Inclusive Virtual Classroom"
        subHeading="Innovative Design & Future Concepts"
        videoSrc="homempage_video.mp4"
        isMainSection
      />
      <Section
        background="#000000"
        heading="Our Services"
        content={<ServiceList />}
      />
      <Section
        background="#000000"
        heading="Contact Us"
        subHeading="Let's work together to create something amazing."
      />
    </div>
  );
}

function Section({ background, heading, subHeading, videoSrc, content, isMainSection }) {
  return (
    <div style={{ ...styles.section, background }}>
      {isMainSection && (
        <div style={styles.videoBackground}>
          <video autoPlay muted loop style={styles.video}>
            <source src={videoSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      <div style={styles.content} className="fade-in">
        <h1>{heading}</h1>
        {subHeading && <p>{subHeading}</p>}
        {content && content}
      </div>
    </div>
  );
}

function ServiceList() {
  return (
    <div style={styles.servicesContainer}>
      <div style={styles.serviceBox}>
        <div style={styles.serviceTitle}>Feature 1</div>
        <div style={styles.serviceDescription}>Description of the first feature.</div>
      </div>
      <div style={styles.serviceBox}>
        <div style={styles.serviceTitle}>Feature 2</div>
        <div style={styles.serviceDescription}>Description of the second feature.</div>
      </div>
      <div style={styles.serviceBox}>
        <div style={styles.serviceTitle}>Feature 3</div>
        <div style={styles.serviceDescription}>Description of the third feature.</div>
      </div>
      <div style={styles.serviceBox}>
        <div style={styles.serviceTitle}>Feature 4</div>
        <div style={styles.serviceDescription}>Description of the fourth feature.</div>
      </div>
    </div>
  );
}

// Inline styles
const styles = {
  header: {
    position: 'fixed',
    top: 0,
    width: '100%',
    zIndex: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    color: 'white',
    backdropFilter: 'blur(10px)',
    boxSizing: 'border-box',
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  nav: {
    display: 'flex',
    gap: '15px',
  },
  navLink: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '1rem',
    padding: '5px 10px',
    transition: 'color 0.3s',
    whiteSpace: 'nowrap',
  },
  container: {
    scrollSnapType: 'y mandatory',
    overflowY: 'scroll',
    height: '100vh',
  },
  section: {
    scrollSnapAlign: 'start',
    position: 'relative',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    textAlign: 'center',
    fontSize: '2rem',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: -1,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  servicesContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  serviceBox: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '20px',
    textAlign: 'center',
    transition: 'transform 0.2s',
  },
  serviceBoxHover: {
    transform: 'translateY(-5px)',
    boxShadow: '0 8px 12px rgba(0, 0, 0, 0.2)',
  },
  serviceTitle: {
    fontSize: '1.5em',
    margin: '10px 0',
    color: '#4CAF50',
  },
  serviceDescription: {
    fontSize: '1em',
    color: '#000000',
  },
  popup: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  popupContent: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    maxWidth: '500px',
    textAlign: 'center',
  },
  textarea: {
    width: '90%',
    height: '100px',
    padding: '10px',
    fontSize: '1rem',
    marginBottom: '10px',
  },
  button: {
    backgroundColor: '#4CAF50', // Green background
    color: '#ffffff', // White text for better contrast
    border: 'none',
    padding: '10px 20px',
    fontSize: '1rem',
    margin: '5px',
    cursor: 'pointer',
    borderRadius: '5px',
  },
};

export default App;
