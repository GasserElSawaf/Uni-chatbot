// src/components/Chatbot.js

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../App.css";
import { useNavigate } from "react-router-dom";

function Chatbot({ isLoggedIn }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("question"); // 'question' or 'registration'
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState("");

  // State for Manage Account Modal
  const [showManageAccount, setShowManageAccount] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [updateForm, setUpdateForm] = useState({
    phoneNumber: "",
    email: "",
    secretQuestion: "",
    secretAnswer: "",
    password: "",
    confirmPassword: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateMessageType, setUpdateMessageType] = useState("");

  // Generate a unique session ID for the user
  const [sessionId] = useState(
    () => Date.now() + "-" + Math.random().toString(36).substr(2, 9)
  );

  // Ref to track the initial render
  const isFirstRender = useRef(true);

  // Helper function to count words
  const countWords = (text) => {
    return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  };

  // Function to handle input changes
  const handleInputChange = (e) => {
    const text = e.target.value;
    const words = countWords(text);

    if (words <= 250) {
      setInput(text);
      setWordCount(words);
      setError("");
    } else {
      setError("You have exceeded the 250-word limit.");
      setWordCount(words);
    }
  };

  // Function to send messages to the backend
  const sendMessage = async (message, isUser = true) => {
    const words = countWords(message);

    if (isUser && words === 0) {
      // Do not send empty messages
      return;
    }

    if (isUser && words > 250) {
      setError("Cannot send message. Please reduce your message to 250 words.");
      return;
    }

    if (isUser && message.trim() !== "") {
      setMessages((prev) => [...prev, { sender: "user", text: message }]);
      setInput("");
      setWordCount(0);
      setError("");
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post("http://localhost:5000/api/chat", {
        question: message,
        mode,
        session_id: sessionId,
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: response.data.answer },
      ]);
    } catch (error) {
      console.error("Error fetching bot response:", error);
      if (error.response && error.response.data && error.response.data.error) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: error.response.data.error },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Sorry, something went wrong." },
        ]);
      }
    }
  };

  // Initialize with a greeting message on first mount
  useEffect(() => {
    setMessages([{ sender: "bot", text: "Hello! How can I assist you today?" }]);
  }, []);

  // Handle mode changes
  useEffect(() => {
    // Skip the effect on the initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (mode === "question") {
      // Append the greeting message when switching to 'question' mode
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Hello! How can I assist you today?" },
      ]);
    } else if (mode === "registration") {
      // Initiate or resume the registration process
      sendMessage("", false);
    }
  }, [mode]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login");
    }
  }, [isLoggedIn, navigate]);

  // Handle user logout
  const handleLogout = () => {
    // Clear localStorage and redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('accountType');
    navigate("/login");
    window.location.reload();
  };

  // Function to open Manage Account Modal
  const handleManageAccountClick = async () => {
    setShowManageAccount(true);
    setUpdateMessage("");
    setUpdateMessageType("");
    setIsUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get("http://localhost:5000/api/user", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setUserInfo(response.data.user);
      setUpdateForm({
        phoneNumber: response.data.user.phoneNumber || "",
        email: response.data.user.email || "",
        secretQuestion: response.data.user.secretQuestion || "",
        secretAnswer: "", // For security, do not pre-fill secret answer
        password: "",
        confirmPassword: "",
      });
      setIsUpdating(false);
    } catch (error) {
      console.error("Error fetching user info:", error);
      setUpdateMessage("Failed to load account information.");
      setUpdateMessageType("error");
      setIsUpdating(false);
    }
  };

  // Function to handle form input changes in Manage Account Modal
  const handleUpdateFormChange = (e) => {
    const { name, value } = e.target;
    setUpdateForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to handle account update submission
  const handleAccountUpdate = async (e) => {
    e.preventDefault();
    setUpdateMessage("");
    setUpdateMessageType("");

    // Client-side validation
    if (updateForm.password !== updateForm.confirmPassword) {
      setUpdateMessage("Passwords do not match.");
      setUpdateMessageType("error");
      return;
    }

    try {
      setIsUpdating(true);
      const token = localStorage.getItem('token');
      const payload = {
        phoneNumber: updateForm.phoneNumber,
        email: updateForm.email,
        secretQuestion: updateForm.secretQuestion,
        // Only include secretAnswer if it's provided
        ...(updateForm.secretAnswer && { secretAnswer: updateForm.secretAnswer }),
        // Only include password if it's provided
        ...(updateForm.password && { password: updateForm.password }),
      };

      const response = await axios.put("http://localhost:5000/api/user", payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setUpdateMessage(response.data.message);
      setUpdateMessageType("success");

      // Optionally, update localStorage or state if necessary
      // For example, if email is stored locally

      setIsUpdating(false);
    } catch (error) {
      console.error("Error updating account info:", error);
      const errorMsg = error.response?.data?.message || "Failed to update account information.";
      setUpdateMessage(errorMsg);
      setUpdateMessageType("error");
      setIsUpdating(false);
    }
  };

  // Function to close Manage Account Modal
  const handleCloseManageAccount = () => {
    setShowManageAccount(false);
    setUserInfo(null);
    setUpdateForm({
      phoneNumber: "",
      email: "",
      secretQuestion: "",
      secretAnswer: "",
      password: "",
      confirmPassword: "",
    });
    setUpdateMessage("");
    setUpdateMessageType("");
  };

  return (
    <div className="App">
      <div className="header">
        <h1>University Registration Chatbot</h1>
        <button
          onClick={handleLogout}
          style={{ float: "right", marginRight: "20px" }}
        >
          Logout
        </button>
        <button
          onClick={handleManageAccountClick}
          style={{ float: "right", marginRight: "10px" }}
        >
          Manage Account
        </button>
        <div className="toggle-container">
          <span className={mode === "question" ? "active" : ""}>
            Question Answering
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={mode === "registration"}
              onChange={(e) =>
                setMode(e.target.checked ? "registration" : "question")
              }
            />
            <span className="slider"></span>
          </label>
          <span className={mode === "registration" ? "active" : ""}>
            Registration
          </span>
        </div>
      </div>
      <div className="chatbox">
        <div className="messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${
                message.sender === "bot" ? "bot" : "user"
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>
        <div className="input-box">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            onKeyPress={(e) => {
              if (e.key === "Enter" && wordCount <= 250) {
                sendMessage(input);
              }
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={wordCount > 250}
          >
            Send
          </button>
          <div className={`word-counter ${wordCount > 250 ? "exceeded" : ""}`}>
            {wordCount}/250 words
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>

      {/* Manage Account Modal */}
      {showManageAccount && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Manage Account</h2>
            {isUpdating ? (
              <p>Loading...</p>
            ) : (
              <form onSubmit={handleAccountUpdate} className="edit-form">
                {updateMessage && (
                  <div className={`message-box ${updateMessageType}`}>
                    {updateMessage}
                  </div>
                )}
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={userInfo.username}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Account Type</label>
                  <input
                    type="text"
                    value={userInfo.accountType}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={updateForm.phoneNumber}
                    onChange={handleUpdateFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={updateForm.email}
                    onChange={handleUpdateFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Secret Question</label>
                  <select
                    name="secretQuestion"
                    value={updateForm.secretQuestion}
                    onChange={handleUpdateFormChange}
                    required
                  >
                    <option value="What is your favourite color?">What is your favourite color?</option>
                    <option value="What is your favorite food?">What is your favorite food?</option>
                    <option value="What is your parent name (mother or father)?">
                      What is your parent name (mother or father)?
                    </option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Secret Answer</label>
                  <input
                    type="text"
                    name="secretAnswer"
                    value={updateForm.secretAnswer}
                    onChange={handleUpdateFormChange}
                    placeholder="Leave blank to keep current answer"
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    name="password"
                    value={updateForm.password}
                    onChange={handleUpdateFormChange}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={updateForm.confirmPassword}
                    onChange={handleUpdateFormChange}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="save-btn" disabled={isUpdating}>
                    Save
                  </button>
                  <button type="button" className="cancel-btn" onClick={handleCloseManageAccount}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Chatbot;
