# STENIVA — Beauty & Wellness Booking System

A full-stack appointment booking web application developed for a fictional premium beauty and wellness studio.

STENIVA combines a modern, responsive interface with a Node.js backend, SQLite database, real-time appointment availability, and an administrative booking management dashboard.

## Features

### Customer Experience
- Responsive website with a premium, minimalist design
- Three wellness treatments with dedicated descriptions and pricing
- Appointment booking with treatment, specialist, date, and time selection
- Real-time availability based on existing reservations
- Automatic prevention of overlapping appointments
- Five-minute temporary appointment holds
- Countdown timer and automatic release of expired holds
- Automatic availability updates
- Email confirmations for successful bookings

### Admin Dashboard
- Secure administrator login with session-based authentication
- Booking management dashboard
- Booking statistics and upcoming appointments
- Search and filtering by status, specialist, and date
- Appointment cancellation
- Automatic cancellation emails
- Booking status management without deleting reservation history

## Technologies

**Frontend**
- HTML5
- CSS3
- JavaScript (Vanilla JS)
- Flatpickr for date selection

**Backend**
- Node.js
- Express.js
- REST API
- SQLite with better-sqlite3

**Security and Integrations**
- bcryptjs for password verification
- express-session for administrator sessions
- express-rate-limit for request limiting
- dotenv for environment configuration
- Mailjet API for transactional emails

## How Appointment Booking Works

1. The customer selects a treatment, specialist, and appointment date.
2. The system retrieves available time slots from the backend.
3. Selecting a time creates a temporary five-minute hold.
4. Overlapping time slots become unavailable to other customers.
5. The customer completes the reservation before the hold expires.
6. The backend validates the hold and stores the confirmed booking in SQLite.
7. A confirmation email is sent to the customer.

If the temporary hold expires, the appointment time becomes available again.

## Getting Started

### Prerequisites

- Node.js and npm
- Git
- A modern web browser

### Installation

Clone the repository and install the dependencies:

```bash
git clone YOUR_REPOSITORY_URL
cd BookFlow
npm ci
```

Replace `YOUR_REPOSITORY_URL` with the actual GitHub repository URL after publishing.

### Environment Configuration

Create a `.env` file in the project root and configure the required environment variables:

```env
SESSION_SECRET=your_session_secret
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD_HASH=your_bcrypt_password_hash

MAILJET_API_KEY=your_mailjet_api_key
MAILJET_SECRET_KEY=your_mailjet_secret_key
MAILJET_SENDER_EMAIL=your_verified_sender_email
```

Never commit actual credentials or API keys to GitHub.

### Start the Backend

```bash
npm start
```

The start process initializes the SQLite bookings table and runs the Express server.

Local backend address:

`http://localhost:3000`

### Start the Frontend Locally

From the project directory, run:

```bash
python -m http.server 5500
```

On Windows, `py -m http.server 5500` can also be used.

Open the website at:

`http://127.0.0.1:5500`

The frontend and backend must both be running for the booking functionality to work.

## Project Structure

```text
BookFlow/
├── assets/
├── css/
│   └── style.css
├── js/
│   └── script.js
├── index.html
├── booking.html
├── admin.html
├── server.js
├── database.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Development and Security Notes

- Administrator passwords are verified using bcrypt.
- Administrator access uses server-side sessions.
- Booking availability is checked again during database transactions.
- Temporary appointment holds are validated before confirmation.
- Rate limiting is applied to login and appointment-hold requests.
- Environment secrets, database files, and installed dependencies are excluded from version control.
- Persistent database storage and production configuration are required for cloud deployment.

## Project Status

Core booking and administrator functionality has been implemented and tested locally.

Cloud deployment and the public demo link are planned as the next stage.

## Purpose

STENIVA was developed as a portfolio project to demonstrate practical frontend and backend development, REST API integration, relational database management, asynchronous operations, and appointment scheduling logic.

The studio is fictional and the project is intended for educational and portfolio purposes.