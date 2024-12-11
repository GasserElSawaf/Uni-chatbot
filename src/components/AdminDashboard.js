// src/components/AdminDashboard.js

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal'; 
import '../App.css';

Modal.setAppElement('#root');

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRegistrations, setShowRegistrations] = useState(false);

  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [originalHtmlContent, setOriginalHtmlContent] = useState("");
  const [isEditingHtml, setIsEditingHtml] = useState(false);
  const [message, setMessage] = useState("");

  const contentRef = useRef(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // State for Manage Account Modal
  const [showManageAccount, setShowManageAccount] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [updateAdminForm, setUpdateAdminForm] = useState({
    phoneNumber: "",
    email: "",
    secretQuestion: "",
    secretAnswer: "",
    password: "",
    confirmPassword: "",
  });
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);
  const [adminUpdateMessage, setAdminUpdateMessage] = useState("");
  const [adminUpdateMessageType, setAdminUpdateMessageType] = useState("");

  useEffect(() => {
    const accountType = localStorage.getItem('accountType');
    if (accountType !== 'Admin') {
      navigate('/login');
    }
  }, [navigate]);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/registrations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRegistrations(response.data.registrations);
    } catch (err) {
      console.error("Error fetching registrations:", err);
      setError("Failed to fetch registrations.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRegistrations = async () => {
    if (!showRegistrations) {
      await fetchRegistrations();
    }
    setShowRegistrations(!showRegistrations);
    setShowHtmlEditor(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('accountType');
    navigate('/login');
    window.location.reload();
  };

  const fetchHtmlContent = async () => {
    setError(null);
    setMessage("");
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/get-html', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setOriginalHtmlContent(response.data.html);
        if (contentRef.current) {
          contentRef.current.innerHTML = response.data.html;
        }
      } else {
        setError("Failed to load HTML content.");
      }
    } catch (err) {
      console.error("Error fetching HTML content:", err);
      setError("Error fetching HTML content.");
    }
  };

  const handleToggleHtmlEditor = () => {
    setShowHtmlEditor(!showHtmlEditor);
    setShowRegistrations(false);
    setIsEditingHtml(false);
    setMessage("");
  };

  useEffect(() => {
    if (showHtmlEditor) {
      fetchHtmlContent();
    }
  }, [showHtmlEditor]);

  const handleEditClick = () => {
    setIsEditingHtml(true);
    setMessage("Editing mode enabled.");
  };

  const handleCancelClick = () => {
    if (contentRef.current) {
      contentRef.current.innerHTML = originalHtmlContent;
    }
    setIsEditingHtml(false);
    setMessage("Changes canceled.");
  };

  const handleSaveClick = async () => {
    if (!contentRef.current) return;
    const updatedContent = contentRef.current.innerHTML;
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post('http://localhost:5000/api/update-html',
        { html: updatedContent },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setOriginalHtmlContent(updatedContent);
        setIsEditingHtml(false);
        setMessage(response.data.message);
      } else {
        setMessage(response.data.message);
      }
    } catch (err) {
      console.error("Error applying changes:", err);
      setMessage("Error applying changes.");
    }
  };

  const openEditModal = (student) => {
    setCurrentStudent(student);
    setEditFormData({ ...student });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setCurrentStudent(null);
    setEditFormData({});
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    const registrationId = currentStudent._id;

    try {
      const token = localStorage.getItem('token');
      const { _id, ...updateData } = editFormData;

      const response = await axios.put(`http://localhost:5000/registrations/${registrationId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 200) {
        setMessage(response.data.message);
        fetchRegistrations();
        closeEditModal();
      }
    } catch (err) {
      console.error("Error updating registration:", err);
      setError("Failed to update registration.");
    }
  };

  // Functions for Manage Account Modal
  const handleManageAccountClick = async () => {
    setShowManageAccount(true);
    setAdminUpdateMessage("");
    setAdminUpdateMessageType("");
    setIsUpdatingAdmin(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get("http://localhost:5000/api/user", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setAdminInfo(response.data.user);
      setUpdateAdminForm({
        phoneNumber: response.data.user.phoneNumber || "",
        email: response.data.user.email || "",
        secretQuestion: response.data.user.secretQuestion || "",
        secretAnswer: "", // For security, do not pre-fill secret answer
        password: "",
        confirmPassword: "",
      });
      setIsUpdatingAdmin(false);
    } catch (error) {
      console.error("Error fetching admin info:", error);
      setAdminUpdateMessage("Failed to load account information.");
      setAdminUpdateMessageType("error");
      setIsUpdatingAdmin(false);
    }
  };

  const handleUpdateAdminFormChange = (e) => {
    const { name, value } = e.target;
    setUpdateAdminForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAdminAccountUpdate = async (e) => {
    e.preventDefault();
    setAdminUpdateMessage("");
    setAdminUpdateMessageType("");

    // Client-side validation
    if (updateAdminForm.password !== updateAdminForm.confirmPassword) {
      setAdminUpdateMessage("Passwords do not match.");
      setAdminUpdateMessageType("error");
      return;
    }

    try {
      setIsUpdatingAdmin(true);
      const token = localStorage.getItem('token');
      const payload = {
        phoneNumber: updateAdminForm.phoneNumber,
        email: updateAdminForm.email,
        secretQuestion: updateAdminForm.secretQuestion,
        // Only include secretAnswer if it's provided
        ...(updateAdminForm.secretAnswer && { secretAnswer: updateAdminForm.secretAnswer }),
        // Only include password if it's provided
        ...(updateAdminForm.password && { password: updateAdminForm.password }),
      };

      const response = await axios.put("http://localhost:5000/api/user", payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setAdminUpdateMessage(response.data.message);
      setAdminUpdateMessageType("success");

      // Optionally, update localStorage or state if necessary
      // For example, if email is stored locally

      setIsUpdatingAdmin(false);
    } catch (error) {
      console.error("Error updating admin account info:", error);
      const errorMsg = error.response?.data?.message || "Failed to update account information.";
      setAdminUpdateMessage(errorMsg);
      setAdminUpdateMessageType("error");
      setIsUpdatingAdmin(false);
    }
  };

  const handleCloseManageAccount = () => {
    setShowManageAccount(false);
    setAdminInfo(null);
    setUpdateAdminForm({
      phoneNumber: "",
      email: "",
      secretQuestion: "",
      secretAnswer: "",
      password: "",
      confirmPassword: "",
    });
    setAdminUpdateMessage("");
    setAdminUpdateMessageType("");
  };

  return (
    <div className="dashboard">
      <h1>Admin Dashboard</h1>
      <button onClick={handleLogout} className="logout-btn">Logout</button>
      {/* Add Manage Account Button */}
      <button
        onClick={handleManageAccountClick}
        className="manage-account-btn"
        style={{ float: "right", marginRight: "10px", backgroundColor: '#4CAF50', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        Manage Account
      </button>

      <div className="fetch-section">
        <button
          onClick={handleToggleRegistrations}
          disabled={isLoading}
          className="fetch-btn"
        >
          {isLoading ? "Fetching Registrations..." : "View All Registered Students"}
        </button>
        <button
          onClick={handleToggleHtmlEditor}
          className="info-btn"
          style={{ backgroundColor: '#6A5ACD', marginLeft: '10px' }}
        >
          University Info
        </button>
      </div>

      {/* Show error only once at the top */}
      {error && <p className="error">{error}</p>}

      {showRegistrations && registrations.length > 0 && (
        <div className="registrations-list">
          <h2>Registered Students</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Actions</th>
                  <th>Full Name</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th>Nationality</th>
                  <th>National ID</th>
                  <th>Mobile Number</th>
                  <th>Email</th>
                  <th>Parent/Guardian Name</th>
                  <th>Parent/Guardian Contact</th>
                  <th>Parent/Guardian Email</th>
                  <th>High School</th>
                  <th>Graduation Year</th>
                  <th>GPA</th>
                  <th>Preferred Major</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <button onClick={() => openEditModal(student)} className="edit-btn">
                        Edit
                      </button>
                    </td>
                    <td>{student['Student Full Name']}</td>
                    <td>{student['Date of Birth']}</td>
                    <td>{student['Gender']}</td>
                    <td>{student['Nationality']}</td>
                    <td>{student['National ID']}</td>
                    <td>{student['Mobile Number']}</td>
                    <td>{student['Email Address']}</td>
                    <td>{student['Parent/Guardian Name']}</td>
                    <td>{student['Parent/Guardian Contact Number']}</td>
                    <td>{student['Parent/Guardian Email Address']}</td>
                    <td>{student['High School Name']}</td>
                    <td>{student['Graduation Year']}</td>
                    <td>{student['GPA']}</td>
                    <td>{student['Preferred Major/Program']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isEditModalOpen}
        onRequestClose={closeEditModal}
        contentLabel="Edit Registration"
        className="modal"
        overlayClassName="modal-overlay"
      >
        <h2>Edit Student Information</h2>
        {currentStudent && (
          <form onSubmit={handleEditFormSubmit} className="edit-form">
            <label>
              Student Full Name:
              <input
                type="text"
                name="Student Full Name"
                value={editFormData['Student Full Name']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Date of Birth:
              <input
                type="text"
                name="Date of Birth"
                value={editFormData['Date of Birth']}
                onChange={handleEditFormChange}
                required
                placeholder="e.g., 1-10-2000"
              />
            </label>
            <label>
              Gender:
              <select
                name="Gender"
                value={editFormData['Gender']}
                onChange={handleEditFormChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>
              Nationality:
              <input
                type="text"
                name="Nationality"
                value={editFormData['Nationality']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              National ID:
              <input
                type="text"
                name="National ID"
                value={editFormData['National ID']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Mobile Number:
              <input
                type="text"
                name="Mobile Number"
                value={editFormData['Mobile Number']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Email Address:
              <input
                type="email"
                name="Email Address"
                value={editFormData['Email Address']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Parent/Guardian Name:
              <input
                type="text"
                name="Parent/Guardian Name"
                value={editFormData['Parent/Guardian Name']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Parent/Guardian Contact Number:
              <input
                type="text"
                name="Parent/Guardian Contact Number"
                value={editFormData['Parent/Guardian Contact Number']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Parent/Guardian Email Address:
              <input
                type="email"
                name="Parent/Guardian Email Address"
                value={editFormData['Parent/Guardian Email Address']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              High School Name:
              <input
                type="text"
                name="High School Name"
                value={editFormData['High School Name']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Graduation Year:
              <input
                type="number"
                name="Graduation Year"
                value={editFormData['Graduation Year']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              GPA:
              <input
                type="number"
                step="0.01"
                name="GPA"
                value={editFormData['GPA']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <label>
              Preferred Major/Program:
              <input
                type="text"
                name="Preferred Major/Program"
                value={editFormData['Preferred Major/Program']}
                onChange={handleEditFormChange}
                required
              />
            </label>
            <div className="modal-actions">
              <button type="submit" className="save-btn">Save</button>
              <button type="button" onClick={closeEditModal} className="cancel-btn">Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Manage Account Modal */}
      {showManageAccount && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Manage Account</h2>
            {isUpdatingAdmin ? (
              <p>Loading...</p>
            ) : (
              <form onSubmit={handleAdminAccountUpdate} className="edit-form">
                {adminUpdateMessage && (
                  <div className={`message-box ${adminUpdateMessageType}`}>
                    {adminUpdateMessage}
                  </div>
                )}
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={adminInfo.username}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Account Type</label>
                  <input
                    type="text"
                    value={adminInfo.accountType}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={updateAdminForm.phoneNumber}
                    onChange={handleUpdateAdminFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={updateAdminForm.email}
                    onChange={handleUpdateAdminFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Secret Question</label>
                  <select
                    name="secretQuestion"
                    value={updateAdminForm.secretQuestion}
                    onChange={handleUpdateAdminFormChange}
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
                    value={updateAdminForm.secretAnswer}
                    onChange={handleUpdateAdminFormChange}
                    placeholder="Leave blank to keep current answer"
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    name="password"
                    value={updateAdminForm.password}
                    onChange={handleUpdateAdminFormChange}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={updateAdminForm.confirmPassword}
                    onChange={handleUpdateAdminFormChange}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="save-btn" disabled={isUpdatingAdmin}>
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

      {showHtmlEditor && (
        <div>
          <h2>University HTML Content</h2>
          {/* Edit and Save/Cancel buttons at the beginning */}
          <div style={{ marginBottom: '10px' }}>
            {!isEditingHtml && (
              <button id="editBtn" onClick={handleEditClick} className="edit-btn">
                Edit
              </button>
            )}
            {isEditingHtml && (
              <>
                <button id="saveBtn" onClick={handleSaveClick} className="save-btn">
                  Save
                </button>
                <button id="cancelBtn" onClick={handleCancelClick} className="cancel-btn" style={{ marginLeft: '10px' }}>
                  Cancel
                </button>
              </>
            )}
          </div>
          {/* Display the message once only here */}
          {message && <p className="message-box success">{message}</p>}
          <div
            id="content"
            ref={contentRef}
            contentEditable={isEditingHtml ? "true" : "false"}
            style={{
              border: isEditingHtml ? '1px solid #66afe9' : '1px solid #ccc',
              padding: '15px',
              minHeight: '500px',
              whiteSpace: 'pre-wrap',
              backgroundColor: isEditingHtml ? '#fff' : '#f9f9f9',
              textAlign: 'left'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
