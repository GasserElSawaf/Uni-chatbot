// src/components/Register.js

import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../App.css";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    accountType: "Admin",
    phoneNumber: "",
    email: "",
    secretQuestion: "What is your favourite color?", // Default secret question
    secretAnswer: "",
  });
  const [message, setMessage] = useState(""); // State for success or error message
  const [messageType, setMessageType] = useState(""); // 'success' or 'error'

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Allow only numerical values for the phoneNumber field
    if (name === "phoneNumber") {
      if (!/^\d*$/.test(value)) return; // Prevent non-numerical input
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleRegister = async () => {
    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    if (!emailRegex.test(formData.email)) {
      setMessage("Invalid email address format.");
      setMessageType("error");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/register", formData);
      // Display success message and navigate
      setMessage(response.data.message);
      setMessageType("success");
      setTimeout(() => navigate("/login"), 2000); // Redirect after 2 seconds
    } catch (error) {
      // Display error message
      setMessage(error.response?.data?.message || "Error during registration.");
      setMessageType("error");
    }
  };

  return (
    <div className="box">
      <h1>Register</h1>
      {message && (
        <div className={`message-box ${messageType}`}>
          {message}
        </div>
      )}
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
      <input
        type="password"
        name="confirmPassword"
        placeholder="Confirm Password"
        value={formData.confirmPassword}
        onChange={handleChange}
        required
      />
      <input
        type="text"
        name="phoneNumber"
        placeholder="Phone Number"
        value={formData.phoneNumber}
        onChange={handleChange}
      />
      <input
        type="email"
        name="email"
        placeholder="Email Address"
        value={formData.email}
        onChange={handleChange}
        required
      />
      <select
        name="secretQuestion"
        value={formData.secretQuestion}
        onChange={handleChange}
      >
        <option value="What is your favourite color?">What is your favourite color?</option>
        <option value="What is your favorite food?">What is your favorite food?</option>
        <option value="What is your parent name (mother or father)?">
          What is your parent name (mother or father)?
        </option>
      </select>
      <input
        type="text"
        name="secretAnswer"
        placeholder="Answer to Secret Question"
        value={formData.secretAnswer}
        onChange={handleChange}
        required
      />
      <select name="accountType" value={formData.accountType} onChange={handleChange}>
        <option value="Admin">Admin</option>
        <option value="Student">Student</option>
      </select>
      <button onClick={handleRegister}>Submit</button>
      <button className="back-btn" onClick={() => navigate("/")}>Back</button>
    </div>
  );
};

export default Register;
