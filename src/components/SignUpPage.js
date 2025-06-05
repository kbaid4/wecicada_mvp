import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './SignUpPage.module.css';

import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    companyname: '',
    type: '',
    eventType: '',
    serviceType: '',
    address: '',
    taxid: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Track window width for responsive background image
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const bgStyle = windowWidth > 600 ? {
    backgroundImage: `url(${process.env.PUBLIC_URL}/images/landingpage/loginbg.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  } : undefined;


  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');

    // Prevent duplicate registration by email
    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', formData.email)
      .single();
    if (existing) {
      setError('An account with this email already exists.');
      return;
    }

    try {
      // DEBUG: Log what type is selected at signup
      console.log('SignUp: formData.type =', formData.type);
      // DEBUG: Log the full signup payload
      const signupPayload = {
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            companyname: formData.companyname,
            user_type: formData.type === "Admin" ? "admin" : (formData.type === "Supplier" ? "supplier" : ""),
            eventType: formData.eventType,
            serviceType: formData.serviceType,
            address: formData.address,
            taxid: formData.taxid,
            phone: formData.phone
          }
        }
      };
      console.log('SignUp: signupPayload =', signupPayload);
      // 1. Sign up the user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            companyname: formData.companyname,
            user_type: formData.type === "Admin" ? "admin" : (formData.type === "Supplier" ? "supplier" : ""),
            eventType: formData.eventType,
            serviceType: formData.serviceType,
            address: formData.address,
            taxid: formData.taxid,
            phone: formData.phone
          }
        }
      });

      if (signUpError) {
        console.error('Supabase signUp error:', signUpError.message);
        setError('Signup failed: ' + signUpError.message);
        return;
      }
      if (!authData || !authData.user || !authData.user.id) {
        setError('Signup failed: No user data returned.');
        return;
      }
      // 2. Redirect after successful signup
      if (formData.type === "Admin") {
        navigate("/SuppliersPage");
      } else if (formData.type === "Supplier") {
        // Store supplier info and serviceType in localStorage
        const signedUpSuppliers = JSON.parse(localStorage.getItem('signedUpSuppliers') || '[]');
        signedUpSuppliers.push({
          id: authData.user.id,
          name: formData.name,
          email: formData.email,
          serviceType: formData.serviceType
        });
        localStorage.setItem('signedUpSuppliers', JSON.stringify(signedUpSuppliers));
        navigate("/SupplierHomepage");
      } else {
        setError('Unknown user type, cannot redirect.');
      }
    } catch (error) {
      console.error('Signup handler error:', error);
      setError(error.message || 'An unknown error occurred.');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div
      className={styles['main-container']}
      style={bgStyle}
    >
      <div className={styles['signup-container']}>
        <div className={styles['logo-container']}>
          <img 
            src={`${process.env.PUBLIC_URL}/images/landingpage/logo.png`} 
            alt="CITADA Logo" 
            className={styles['site-logo']}
          />
        </div>        
        <form onSubmit={handleSubmit} className={styles['signup-form']}>
          <div className={styles['form-group']}>
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="companyname">Company Name</label>
            <input
              type="text"
              id="companyname"
              name="companyname"
              value={formData.companyname}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="type">Title</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select service type</option>
              <option value="Admin">Admin</option>
              <option value="Supplier">Supplier</option>
            </select>
          </div>

          {formData.type === "Admin" && (
            <div className={styles['form-group']}>
              <label htmlFor="eventType">Event Type</label>
              <select
                id="eventType"
                name="eventType"
                value={formData.eventType}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select event type</option>
                <option value="Corporate Events">Corporate Events</option>
                <option value="Social Events">Social Events</option>
                <option value="Networking Events">Networking Events</option>
                <option value="Educational Events">Educational Events</option>
                <option value="Trade Shows">Trade Shows</option>
                <option value="Charity Events">Charity Events</option>
                <option value="Cultural Events">Cultural Events</option>
                <option value="Sports Events">Sports Events</option>
              </select>
            </div>
          )}

          {formData.type === "Supplier" && (
            <div className={styles['form-group']}>
              <label htmlFor="serviceType">Service Type</label>
              <select
                id="serviceType"
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select service type</option>
                <option value="Catering">Catering</option>
                <option value="Bartenders">Bartenders</option>
                <option value="Decorators">Decorators</option>
                <option value="DJs">DJs</option>
                <option value="Photobooths">Photobooths</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Convention centers">Convention centers</option>
                <option value="Audio/Visual">Audio/Visual</option>
                <option value="Printing services">Printing services</option>
                <option value="Security services">Security services</option>
                <option value="Transportation">Transportation</option>
                <option value="Performers">Performers</option>
              </select>
            </div>
          )}

          <div className={styles['form-group']}>
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="taxid">Tax ID</label>
            <input
              type="text"
              id="taxid"
              name="taxid"
              value={formData.taxid}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="phone">Phone</label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className={styles['error-message']}>{error}</div>}

          <button type="submit" className={styles['signup-button']}>Register</button>
        </form>
      </div>
    </div>
  );
};

export default SignUpPage;
