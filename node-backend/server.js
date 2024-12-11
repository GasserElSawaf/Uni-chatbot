// server.js

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb"); // Import ObjectId
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");
const sanitizeHtml = require('sanitize-html'); // Added for HTML sanitization
const { htmlToText } = require('html-to-text'); // For converting HTML to text

const app = express();
const port = 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Increased body size limit

// JWT Secret Key
const JWT_SECRET = "s3cUr3K3y!@#R@nd0mStr1ng$%^&*()_+"; 

// MongoDB Configuration
const uri = "mongodb://localhost:27017";
const dbName = "userDatabase";
const usersCollectionName = "users";
const registrationsCollectionName = "registrations";

const client = new MongoClient(uri, { useUnifiedTopology: true });

// Connect to MongoDB once at startup
let db, usersCollection, registrationsCollection;
client.connect()
  .then(() => {
    db = client.db(dbName);
    usersCollection = db.collection(usersCollectionName);
    registrationsCollection = db.collection(registrationsCollectionName);
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });

// JWT Authentication Middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Expecting format: "Bearer <token>"
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT verification failed:", err);
        return res.sendStatus(403); // Forbidden
      }

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
};

// Register API
app.post("/register", async (req, res) => {
  try {
    const { 
      username, 
      password, 
      confirmPassword, 
      accountType, 
      phoneNumber, 
      email, 
      secretQuestion, 
      secretAnswer 
    } = req.body;

    // Validate input
    if (!username || !password || !confirmPassword || !accountType || !phoneNumber || !email || !secretQuestion || !secretAnswer) {
      return res.status(400).send({ message: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).send({ message: "Passwords do not match." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send({ message: "Invalid email address format." });
    }

    const phoneRegex = /^\d+$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).send({ message: "Phone number must contain only numbers." });
    }

    const existingUser = await usersCollection.findOne({ username, accountType });
    if (existingUser) {
      return res.status(400).send({
        message: `Username already exists for account type: ${accountType}. Please choose a different username.`,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedSecretAnswer = await bcrypt.hash(secretAnswer, 10);

    await usersCollection.insertOne({
      username,
      password: hashedPassword,
      accountType,
      phoneNumber,
      email,
      secretQuestion,
      secretAnswer: hashedSecretAnswer,
    });

    res.status(200).send({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send({ message: "Registration failed." });
  }
});

// Login API
app.post("/login", async (req, res) => {
  try {
    const { username, password, accountType } = req.body;

    if (!username || !password || !accountType) {
      return res.status(400).send({ message: "All fields are required." });
    }

    const user = await usersCollection.findOne({ username, accountType });
    if (!user) {
      return res.status(401).send({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { username: user.username, accountType: user.accountType },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).send({ 
      message: `Welcome, ${user.username} (${user.accountType})!`,
      accountType: user.accountType,
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send({ message: "Login failed." });
  }
});

// Forgot Password API - Step 1: Get Secret Question
app.post("/forgot-password", async (req, res) => {
  try {
    const { username, accountType } = req.body;

    if (!username || !accountType) {
      return res.status(400).send({ message: "Username and account type are required." });
    }

    const user = await usersCollection.findOne({ username, accountType });
    if (!user) {
      // For security, do not reveal that the user does not exist
      return res.status(200).send({ message: "If the account exists, the secret question will be sent." });
    }

    res.status(200).send({ 
      message: "Secret question retrieved successfully.",
      secretQuestion: user.secretQuestion 
    });
  } catch (error) {
    console.error("Forgot Password Step 1 error:", error);
    res.status(500).send({ message: "Failed to process request." });
  }
});

// Reset Password API - Step 2: Verify Secret Answer and Update Password
app.post("/reset-password", async (req, res) => {
  try {
    const { username, accountType, secretAnswer, newPassword, confirmNewPassword } = req.body;

    if (!username || !accountType || !secretAnswer || !newPassword || !confirmNewPassword) {
      return res.status(400).send({ message: "All fields are required." });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).send({ message: "Passwords do not match." });
    }

    const user = await usersCollection.findOne({ username, accountType });
    if (!user) {
      // For security, do not reveal that the user does not exist
      return res.status(400).send({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(secretAnswer, user.secretAnswer);
    if (!isMatch) {
      return res.status(400).send({ message: "Incorrect secret answer." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await usersCollection.updateOne(
      { username, accountType },
      { $set: { password: hashedNewPassword } }
    );

    res.status(200).send({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Reset Password error:", error);
    res.status(500).send({ message: "Failed to reset password." });
  }
});

// Protected Route: Get All Registrations (Admin Only)
app.get('/registrations', authenticateJWT, async (req, res) => {
  try {
    if (req.user.accountType !== 'Admin') {
      return res.status(403).send({ message: "Access denied. Admins only." });
    }

    const registrations = await registrationsCollection.find({}).toArray();
    res.status(200).json({ registrations });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ message: "Failed to fetch registrations." });
  }
});

// Protected Route: Get University Info (Authenticated Users)
app.get('/university-info', authenticateJWT, (req, res) => {
  const filePath = path.join(__dirname, "../python-backend/information.txt");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).json({ message: "Failed to load university info." });
    }
    res.status(200).json({ info: data });
  });
});

// Chatbot API
app.post('/api/chat', authenticateJWT, async (req, res) => {
  const { question, mode, session_id } = req.body;

  const countWords = (text) => {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  };

  const wordCount = countWords(question);

  if (wordCount > 250) {
    return res.status(400).json({ error: "Input exceeds the 250-word limit." });
  }

  try {
    if (mode === "question") {
      const response = await axios.post(`http://localhost:8000/chat`, {
        question,
        mode,
        session_id
      }, {
        headers: {
          Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}`
        }
      });

      res.json({ answer: response.data.answer });
    } else if (mode === "registration") {
      const response = await axios.post(`http://localhost:8000/chat`, {
        question,
        mode,
        session_id
      }, {
        headers: {
          Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}`
        }
      });

      res.json({ answer: response.data.answer });
    } else {
      res.status(400).json({ error: "Invalid mode specified." });
    }
  } catch (error) {
    console.error("Error in /api/chat:", error);
    if (error.response && error.response.data && error.response.data.error) {
      res.status(error.response.status).json({ error: error.response.data.error });
    } else {
      res.status(500).json({ error: "Failed to fetch response from the bot." });
    }
  }
});

/** 
 * NEW ENDPOINTS FOR HTML EDITING
 * These endpoints allow an Admin to get and update an HTML file (info.html)
 * and create a text version (output.txt).
 */
// GET endpoint to fetch current HTML (Admin Only)
app.get('/api/get-html', authenticateJWT, (req, res) => {
  if (req.user.accountType !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }

  const filePath = path.join(__dirname, 'info.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading info.html:', err);
      return res.status(500).json({ success: false, message: 'Failed to read HTML file.' });
    }
    res.json({ success: true, html: data });
  });
});

// POST endpoint to update HTML and create text file (Admin Only)
app.post('/api/update-html', authenticateJWT, (req, res) => {
  if (req.user.accountType !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }

  const updatedHTML = req.body.html;
  const filePath = path.join(__dirname, 'info.html');
  //const textFilePath = path.join(__dirname, 'information.txt');
  const textFilePath = path.join(__dirname, '../python-backend/information.txt');
  const sanitizedHTML = sanitizeHtml(updatedHTML, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      '*': ['href', 'align', 'alt', 'center', 'bgcolor', 'src', 'title', 'width', 'height', 'style']
    }
  });

  fs.readFile(filePath, 'utf8', (readErr, originalData) => {
    if (readErr) {
      console.error('Error reading info.html for comparison:', readErr);
      return res.status(500).json({ success: false, message: 'Failed to read HTML file for comparison.' });
    }

    if (originalData === sanitizedHTML) {
      return res.json({ success: true, message: 'No changes detected. HTML file remains unchanged.' });
    }

    fs.writeFile(filePath, sanitizedHTML, 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing to info.html:', writeErr);
        return res.status(500).json({ success: false, message: 'Failed to update HTML file.' });
      }

      const plainText = htmlToText(sanitizedHTML, {
        wordwrap: 130,
        ignoreHref: true,
        ignoreImage: true,
      });

      fs.writeFile(textFilePath, plainText, 'utf8', (textErr) => {
        if (textErr) {
          console.error('Error writing to output.txt:', textErr);
          return res.status(500).json({ success: false, message: 'Failed to create text file.' });
        }

        res.json({ success: true, message: 'HTML file updated and text file created successfully.' });
      });
    });
  });
});

/**
 * NEW ENDPOINT: Update a Registration (Admin Only)
 */
app.put('/registrations/:id', authenticateJWT, async (req, res) => {
  try {
    // Check if the user is an Admin
    if (req.user.accountType !== 'Admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const registrationId = req.params.id;
    const updatedData = req.body;

    // Validate the presence of _id
    if (!ObjectId.isValid(registrationId)) {
      return res.status(400).json({ message: "Invalid registration ID." });
    }

    // Optionally, sanitize the updated data here if necessary
    // For example, using sanitize-html for string fields

    // Perform the update
    const result = await registrationsCollection.updateOne(
      { _id: new ObjectId(registrationId) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Registration not found." });
    }

    res.status(200).json({ message: "Registration updated successfully." });
  } catch (error) {
    console.error("Error updating registration:", error);
    res.status(500).json({ message: "Failed to update registration." });
  }
});

/**
 * NEW ENDPOINTS FOR MANAGING USER ACCOUNT
 * These endpoints allow users to fetch and update their own account information.
 */

// GET endpoint to fetch current user's account info
app.get('/api/user', authenticateJWT, async (req, res) => {
  try {
    const { username, accountType } = req.user;
    const user = await usersCollection.findOne({ username, accountType }, { projection: { password: 0, secretAnswer: 0, _id: 0 } });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).json({ message: "Failed to fetch user information." });
  }
});

// PUT endpoint to update current user's account info
app.put('/api/user', authenticateJWT, async (req, res) => {
  try {
    const { username, accountType } = req.user;
    const updates = req.body;

    // Disallow updating accountType and username directly
    if (updates.accountType || updates.username) {
      return res.status(400).json({ message: "Cannot update account type or username." });
    }

    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // If secretAnswer is being updated, hash it
    if (updates.secretAnswer) {
      updates.secretAnswer = await bcrypt.hash(updates.secretAnswer, 10);
    }

    // Perform the update
    const result = await usersCollection.updateOne(
      { username, accountType },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "Account information updated successfully." });
  } catch (error) {
    console.error("Error updating user info:", error);
    res.status(500).json({ message: "Failed to update account information." });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
