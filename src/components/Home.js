// src/components/Home.js
import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => (
  <div className="box">
    <h1>Welcome!</h1>
    <Link to="/register"><button>Register</button></Link>
    <Link to="/login"><button>Login</button></Link>
  </div>
);

export default Home;
