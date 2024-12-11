// src/components/Login.js

import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Modal from 'react-modal'; // Import react-modal
import "../App.css";

Modal.setAppElement('#root'); // Set the app element for accessibility

const Login = ({ setLoggedIn, setAccountType }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    accountType: "Student", // Default account type
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(""); // State for success or error message
  const [messageType, setMessageType] = useState(""); // 'success' or 'error'

  // States for Forgot Password Modal
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
  const [forgotPasswordData, setForgotPasswordData] = useState({
    username: "",
    accountType: "Student",
    secretAnswer: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");
  const [forgotPasswordMessageType, setForgotPasswordMessageType] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleForgotPasswordChange = (e) => {
    const { name, value } = e.target;
    setForgotPasswordData({ ...forgotPasswordData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(""); // Clear previous messages

    try {
      const response = await axios.post("http://localhost:5000/login", formData);
      const { message, accountType, token } = response.data;

      // Display success message
      setMessage(message);
      setMessageType("success");

      // Store JWT and account type in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('accountType', accountType);

      // Update login and account type state
      setAccountType(accountType);
      setLoggedIn(true);

      // Redirect based on account type after a short delay
      setTimeout(() => {
        if (accountType === "Student") {
          navigate("/chatbot"); // Redirect to Chatbot page
        } else if (accountType === "Admin") {
          navigate("/admin"); // Redirect to Admin Dashboard
        }
      }, 1000); // 1-second delay to display the success message
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error.response?.data?.message || "Error during login.";
      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    setIsForgotPasswordModalOpen(true);
    setForgotPasswordStep(1);
    setForgotPasswordData({
      username: "",
      accountType: "Student",
      secretAnswer: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setForgotPasswordMessage("");
    setForgotPasswordMessageType("");
  };

  const closeForgotPasswordModal = () => {
    setIsForgotPasswordModalOpen(false);
    setForgotPasswordStep(1);
    setForgotPasswordData({
      username: "",
      accountType: "Student",
      secretAnswer: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setForgotPasswordMessage("");
    setForgotPasswordMessageType("");
  };

  const handleForgotPasswordStep1 = async (e) => {
    e.preventDefault();
    setForgotPasswordMessage("");
    setForgotPasswordMessageType("");

    const { username, accountType } = forgotPasswordData;

    if (!username || !accountType) {
      setForgotPasswordMessage("Please provide both username and account type.");
      setForgotPasswordMessageType("error");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/forgot-password", {
        username,
        accountType
      });

      // Even if the user doesn't exist, do not reveal that
      if (response.data.secretQuestion) {
        setForgotPasswordStep(2);
      } else {
        setForgotPasswordStep(2);
      }

      setForgotPasswordMessage(response.data.message);
      setForgotPasswordMessageType("success");
    } catch (error) {
      console.error("Forgot Password Step 1 error:", error);
      setForgotPasswordMessage("Failed to process request.");
      setForgotPasswordMessageType("error");
    }
  };

  const handleForgotPasswordStep2 = async (e) => {
    e.preventDefault();
    setForgotPasswordMessage("");
    setForgotPasswordMessageType("");

    const { username, accountType, secretAnswer, newPassword, confirmNewPassword } = forgotPasswordData;

    if (!secretAnswer || !newPassword || !confirmNewPassword) {
      setForgotPasswordMessage("Please fill in all required fields.");
      setForgotPasswordMessageType("error");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotPasswordMessage("Passwords do not match.");
      setForgotPasswordMessageType("error");
      return;
    }

    // Optional: Add password strength validation here

    try {
      const response = await axios.post("http://localhost:5000/reset-password", {
        username,
        accountType,
        secretAnswer,
        newPassword,
        confirmNewPassword
      });

      setForgotPasswordMessage(response.data.message);
      setForgotPasswordMessageType("success");

      // Optionally, close the modal after a delay
      setTimeout(() => {
        closeForgotPasswordModal();
      }, 2000);
    } catch (error) {
      console.error("Forgot Password Step 2 error:", error);
      const errorMsg = error.response?.data?.message || "Failed to reset password.";
      setForgotPasswordMessage(errorMsg);
      setForgotPasswordMessageType("error");
    }
  };

  return (
    <div className="box">
      <h1>Login</h1>
      {message && (
        <div className={`message-box ${messageType}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <select name="accountType" value={formData.accountType} onChange={handleChange}>
          <option value="Admin">Admin</option>
          <option value="Student">Student</option>
        </select>
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Submit"}
        </button>
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          Back
        </button>
      </form>

      {/* Forgot Password Link */}
      <p style={{ marginTop: '10px' }}>
        <button onClick={openForgotPasswordModal} className="forgot-password-btn">
          Forgot Password?
        </button>
      </p>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotPasswordModalOpen}
        onRequestClose={closeForgotPasswordModal}
        contentLabel="Forgot Password"
        className="modal"
        overlayClassName="modal-overlay"
      >
        <h2>Forgot Password</h2>
        {forgotPasswordMessage && (
          <div className={`message-box ${forgotPasswordMessageType}`}>
            {forgotPasswordMessage}
          </div>
        )}

        {forgotPasswordStep === 1 && (
          <form onSubmit={handleForgotPasswordStep1} className="forgot-password-form">
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                name="username"
                value={forgotPasswordData.username}
                onChange={handleForgotPasswordChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Account Type:</label>
              <select
                name="accountType"
                value={forgotPasswordData.accountType}
                onChange={handleForgotPasswordChange}
                required
              >
                <option value="Admin">Admin</option>
                <option value="Student">Student</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="submit" className="save-btn">Next</button>
              <button type="button" className="cancel-btn" onClick={closeForgotPasswordModal}>Cancel</button>
            </div>
          </form>
        )}

        {forgotPasswordStep === 2 && (
          <form onSubmit={handleForgotPasswordStep2} className="forgot-password-form">
            <div className="form-group">
              <label>Secret Answer:</label>
              <input
                type="text"
                name="secretAnswer"
                value={forgotPasswordData.secretAnswer}
                onChange={handleForgotPasswordChange}
                required
              />
            </div>
            <div className="form-group">
              <label>New Password:</label>
              <input
                type="password"
                name="newPassword"
                value={forgotPasswordData.newPassword}
                onChange={handleForgotPasswordChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password:</label>
              <input
                type="password"
                name="confirmNewPassword"
                value={forgotPasswordData.confirmNewPassword}
                onChange={handleForgotPasswordChange}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="save-btn">Reset Password</button>
              <button type="button" className="cancel-btn" onClick={closeForgotPasswordModal}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Login;
