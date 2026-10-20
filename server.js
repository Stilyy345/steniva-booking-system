
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const session = require("express-session");
const SQLiteStore = require("better-sqlite3-session-store")(session);

const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// Services

const services = {
    massage: {
        name: "Relaxation Massage",
        duration: 60,
        price: 75
    },

    facial: {
        name: "Signature Facial",
        duration: 60,
        price: 90
    },

    aromatherapy: {
        name: "Aromatherapy Ritual",
        duration: 90,
        price: 110
    }
};

// Specialists

const specialistNames = {
    emma: "Emma Wilson",
    sophie: "Sophie Laurent",
    olivia: "Olivia Bennett"
};

// Database connection

// Reuse the existing SQLite database

const db = new Database("steniva.db");
// Temporary booking holds

db.exec(`
    CREATE TABLE IF NOT EXISTS booking_holds (
        token TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        specialist TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_booking_holds_active
    ON booking_holds (date, specialist, expires_at);
`);
console.log("Connected to STENIVA database!");

// Express middleware

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ]
}));

app.use(express.json());

 // Serve frontend files

const path = require("node:path");

app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

app.get(["/", "/index.html"], function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/booking.html", function(req, res) {
    res.sendFile(path.join(__dirname, "booking.html"));
});


// Admin sessions

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing in .env");
}

app.use(session({
    store: new SQLiteStore({
        client: db,
        expired: {
            clear: true,
            intervalMs: 900000
        }
    }),

    name: "steniva.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000
    }
}));

// Admin authentication

const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");

// Limit repeated login attempts
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,

    message: {
        message: "Too many login attempts. Please try again later."
    }
});

 // Limit temporary booking hold requests

const bookingHoldLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 12,
    standardHeaders: "draft-7",
    legacyHeaders: false,

    message: {
        message:
            "Too many appointment selections. Please try again in a few minutes."
    }
});

// Login endpoint

app.post(
    "/api/admin/login",
    adminLoginLimiter,
    async function(req, res) {

        const { username, password } = req.body || {};

        if (
            typeof username !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Please enter username and password."
            });
        }

        if (
            !process.env.ADMIN_USERNAME ||
            !process.env.ADMIN_PASSWORD_HASH
        ) {
            return res.status(503).json({
                message: "Admin login is not configured."
            });
        }

        try {

            const passwordMatches = await bcrypt.compare(
                password,
                process.env.ADMIN_PASSWORD_HASH
            );

            if (
                username !== process.env.ADMIN_USERNAME ||
                !passwordMatches
            ) {
                return res.status(401).json({
                    message: "Invalid username or password."
                });
            }

            // Regenerate the session after login
            req.session.regenerate(function(error) {

                if (error) {
                    console.error("Session error:", error);

                    return res.status(500).json({
                        message: "Unable to create admin session."
                    });
                }

                req.session.isAdmin = true;

                req.session.save(function(saveError) {

                    if (saveError) {
                        console.error("Session save error:", saveError);

                        return res.status(500).json({
                            message: "Unable to save admin session."
                        });
                    }

                    return res.json({
                        message: "Login successful.",
                        authenticated: true
                    });

                });

            });

        } catch (error) {

            console.error("Admin login error:", error);

            return res.status(500).json({
                message: "Unable to complete login."
            });
        }
    }
);


// Email delivery


// Mailjet transport

const mailjetReady = Boolean(
    process.env.MAILJET_API_KEY &&
    process.env.MAILJET_SECRET_KEY &&
    process.env.MAILJET_SENDER_EMAIL &&
    process.env.MAILJET_API_KEY !== "YOUR_API_KEY" &&
    process.env.MAILJET_SECRET_KEY !== "YOUR_SECRET_KEY"
);

const mailTransport = mailjetReady ? {

    async sendMail({ from, to, subject, text, html }) {

        const authorization = Buffer.from(
            process.env.MAILJET_API_KEY +
            ":" +
            process.env.MAILJET_SECRET_KEY
        ).toString("base64");

        const response = await fetch(
            "https://api.mailjet.com/v3.1/send",
            {
                method: "POST",

                headers: {
                    Authorization: "Basic " + authorization,
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    Messages: [
                        {
                            From: {
                                Email: process.env.MAILJET_SENDER_EMAIL,
                                Name: from.name || "STENIVA"
                            },

                            To: [
                                {
                                    Email: to
                                }
                            ],

                            Subject: subject,
                            TextPart: text,
                            HTMLPart: html
                        }
                    ]
                }),

                signal: AbortSignal.timeout(15000)
            }
        );

        const result = await response.json();

        const message = result.Messages?.[0];

        if (
            !response.ok ||
            message?.Status !== "success"
        ) {

            const errorMessage =
                message?.Errors?.[0]?.ErrorMessage ||
                result.ErrorMessage ||
                JSON.stringify(result).slice(0, 350);

            throw new Error(
                "Mailjet API error: " + errorMessage
            );
        }

        return {
            messageId:
                message.To?.[0]?.MessageID ||
                "accepted"
        };
    }

} : null;

if (!mailTransport) {

    console.warn(
        "Mailjet is not configured. Check the MAILJET_ values in .env."
    );

}


// Booking date validation

function isValidBookingDate(dateValue) {

    if (
        typeof dateValue !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
        return false;
    }

    const selectedDate =
        new Date(dateValue + "T12:00:00");

    if (
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate.getFullYear() !==
            Number(dateValue.slice(0, 4)) ||
        selectedDate.getMonth() + 1 !==
            Number(dateValue.slice(5, 7)) ||
        selectedDate.getDate() !==
            Number(dateValue.slice(8, 10))
    ) {
        return false;
    }

    const today = new Date();

    const todayString =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    // Reject past dates
    if (dateValue < todayString) {
        return false;
    }

    // Closed on Sundays
    if (selectedDate.getDay() === 0) {
        return false;
    }

    // Closed on holidays
    const closedDates = [
        "12-24",
        "12-25",
        "12-31",
        "01-01"
    ];

    if (closedDates.includes(dateValue.slice(5))) {
        return false;
    }

    return true;
}

// Booking time validation

function isValidBookingTime(timeValue, duration) {

    if (
        typeof timeValue !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)
    ) {
        return false;
    }

    const [hours, minutes] =
        timeValue.split(":").map(Number);

    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;

    // Half-hour appointment intervals
    if (minutes !== 0 && minutes !== 30) {
        return false;
    }

    // Appointments must end before closing
    if (
        startMinutes < 9 * 60 ||
        endMinutes > 18 * 60
    ) {
        return false;
    }

    return true;
}

// Specialist availability

function isSpecialistAvailable(
    date,
    specialist,
    time,
    duration
) {

    const [hours, minutes] =
        time.split(":").map(Number);

    const requestedStart =
        hours * 60 + minutes;

    const requestedEnd =
        requestedStart + duration;

    const bookings = db.prepare(`
        SELECT time, duration
        FROM bookings
        WHERE date = ?
          AND specialist = ?
          AND status = 'confirmed'
    `).all(date, specialist);

    return bookings.every(function(booking) {

        const [bookedHours, bookedMinutes] =
            booking.time.split(":").map(Number);

        const bookedStart =
            bookedHours * 60 + bookedMinutes;

        const bookedEnd =
            bookedStart + booking.duration;

        return (
            requestedEnd <= bookedStart ||
            requestedStart >= bookedEnd
        );
    });
}
// Check for overlapping temporary booking holds

function hasActiveHoldConflict(date, specialist, time, duration, excludeToken = null) {

    const [hours, minutes] = time.split(":").map(Number);

    const requestedStart = hours * 60 + minutes;
    const requestedEnd = requestedStart + duration;

    const holds = db.prepare(`
        SELECT token, time, duration
        FROM booking_holds
        WHERE date = ?
          AND specialist = ?
          AND expires_at > ?
    `).all(date, specialist, Date.now());

    return holds.some(function(hold) {

        if (hold.token === excludeToken) {
            return false;
        }

        const [holdHours, holdMinutes] =
            hold.time.split(":").map(Number);

        const holdStart = holdHours * 60 + holdMinutes;
        const holdEnd = holdStart + hold.duration;

        return (
            requestedStart < holdEnd &&
            requestedEnd > holdStart
        );
    });
}
// Save booking atomically

 // Create a temporary 5-minute booking hold

const createBookingHold = db.transaction(function(requestedHold) {

    const duration = services[requestedHold.service].duration;
    const now = Date.now();

    // Remove expired holds
    db.prepare(`
        DELETE FROM booking_holds
        WHERE expires_at <= ?
    `).run(now);

    // Support a specific specialist or "No preference"
    const candidates = requestedHold.specialist === "any"
        ? Object.keys(specialistNames)
        : [requestedHold.specialist];

    const assignedSpecialist = candidates.find(function(name) {

        return (
            isSpecialistAvailable(
                requestedHold.date,
                name,
                requestedHold.time,
                duration
            ) &&
            !hasActiveHoldConflict(
                requestedHold.date,
                name,
                requestedHold.time,
                duration
            )
        );
    });

    if (!assignedSpecialist) {
        return null;
    }

    const token = require("node:crypto").randomUUID();
    const expiresAt = now + 5 * 60 * 1000;

    db.prepare(`
        INSERT INTO booking_holds (
            token,
            date,
            specialist,
            time,
            duration,
            expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        token,
        requestedHold.date,
        assignedSpecialist,
        requestedHold.time,
        duration,
        expiresAt
    );

    return {
        token: token,
        specialist: assignedSpecialist,
        expiresAt: expiresAt
    };

}).immediate;


const saveBooking = db.transaction(function(booking) {

    // Assign an available specialist when none is preferred

    const assignedSpecialist =
        booking.specialist === "any"
            ? Object.keys(specialistNames).find(function(name) {
                return isSpecialistAvailable(
                    booking.date,
                    name,
                    booking.time,
                    booking.duration
                );
            })
            : booking.specialist;

    // Recheck availability before inserting
    if (
        !assignedSpecialist ||
        !isSpecialistAvailable(
            booking.date,
            assignedSpecialist,
            booking.time,
            booking.duration
        )
    ) {
        return {
            success: false
        };
    }

    // Store the assigned specialist
    const result = db.prepare(`
        INSERT INTO bookings (
            service,
            specialist,
            date,
            time,
            duration,
            first_name,
            last_name,
            email
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        booking.service,
        assignedSpecialist,
        booking.date,
        booking.time,
        booking.duration,
        booking.firstName,
        booking.lastName,
        booking.email
    );

    // Retain the assigned specialist for confirmation
    booking.specialist = assignedSpecialist;

    return {
        success: true,
        bookingId: Number(result.lastInsertRowid),
        specialist: assignedSpecialist
    };

}).immediate;


 // Confirm a booking using a valid temporary hold

const confirmHeldBooking = db.transaction(function(booking, holdToken) {

    const hold = typeof holdToken === "string"
        ? db.prepare(`
            SELECT token, date, specialist, time, duration
            FROM booking_holds
            WHERE token = ?
              AND expires_at > ?
        `).get(holdToken, Date.now())
        : null;

    // Reject expired, missing or mismatched holds
    if (
        !hold ||
        hold.date !== booking.date ||
        hold.time !== booking.time ||
        hold.duration !== booking.duration ||
        (
            booking.specialist !== "any" &&
            booking.specialist !== hold.specialist
        )
    ) {
        return {
            success: false,
            reason: "hold_expired"
        };
    }

    // Use the specialist reserved by this hold
    booking.specialist = hold.specialist;

    // Save the booking using the existing transaction
    const result = saveBooking(booking);

    if (!result.success) {
        return result;
    }

    // Remove the temporary hold after successful booking
    db.prepare(`
        DELETE FROM booking_holds
        WHERE token = ?
    `).run(holdToken);

    return result;

}).immediate;

// Email helpers

function formatDateEnglish(dateValue) {

    const [year, month, day] =
        dateValue.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

// Escape user input in HTML email content
function escapeHtml(value) {

    return String(value).replace(
        /[&<>"']/g,
        function(character) {

            const replacements = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return replacements[character];
        }
    );
}

// Booking confirmation email

async function sendConfirmationEmail(
    booking,
    bookingId
) {

    if (!mailTransport) {
        throw new Error(
            "SMTP settings are missing in .env"
        );
    }

    const treatment =
        services[booking.service].name;

    const specialist =
        specialistNames[booking.specialist];

    const formattedDate =
        formatDateEnglish(booking.date);

    const safeName =
        escapeHtml(booking.firstName);

    // Plain-text version

    const text = `
Dear ${booking.firstName},

Your appointment at STENIVA is confirmed!

Treatment: ${treatment}
Specialist: ${specialist}
Date: ${formattedDate}
Time: ${booking.time}

Booking reference: #${bookingId}

Thank you for choosing STENIVA.
We look forward to welcoming you!

With care,
The STENIVA Team
    `.trim();

    // HTML version

    const html = `
    <div style="
        background-color:#F7F3ED;
        padding:40px 16px;
        font-family:Arial,sans-serif;
        color:#33352E;
    ">

        <div style="
            max-width:520px;
            margin:auto;
            padding:38px 30px;
            background-color:#FFFFFF;
            border-radius:12px;
        ">

            <p style="
                text-align:center;
                font-size:14px;
                letter-spacing:4px;
                color:#A88B6D;
            ">
                STENIVA
            </p>

            <p style="
                text-align:center;
                font-size:11px;
                letter-spacing:2px;
                color:#A88B6D;
            ">
                WELLNESS STUDIO
            </p>

            <hr style="
                border:0;
                border-top:1px solid #E8E0D6;
                margin:26px 0;
            ">

            <h1 style="
                font-family:Georgia,serif;
                font-size:30px;
                font-weight:normal;
                text-align:center;
                line-height:1.3;
            ">
                Your appointment is confirmed
            </h1>

            <p style="line-height:1.8;">
                Dear ${safeName},
            </p>

            <p style="line-height:1.8;">
                Thank you for choosing STENIVA.
                Your appointment has been successfully
                booked, and we look forward to
                welcoming you.
            </p>

            <div style="
                background-color:#F7F3ED;
                padding:24px;
                margin:28px 0;
                border-radius:8px;
                line-height:2;
                font-size:14px;
            ">

                <strong>Treatment:</strong>
                ${escapeHtml(treatment)}
                <br>

                <strong>Specialist:</strong>
                ${escapeHtml(specialist)}
                <br>

                <strong>Date:</strong>
                ${escapeHtml(formattedDate)}
                <br>

                <strong>Time:</strong>
                ${escapeHtml(booking.time)}
                <br>

                <strong>Booking reference:</strong>
                #${bookingId}

            </div>

            <p style="line-height:1.8;">
                We look forward to seeing you!
            </p>

            <p style="line-height:1.8;">
                With care,
                <br>
                <strong>The STENIVA Team</strong>
            </p>

            <hr style="
                border:0;
                border-top:1px solid #E8E0D6;
                margin:30px 0 20px;
            ">

            <p style="
                text-align:center;
                color:#A88B6D;
                font-size:12px;
            ">
                A MOMENT OF CALM, MADE FOR YOU.
            </p>

        </div>

    </div>
    `;

    return mailTransport.sendMail({

        from: {
            name: "STENIVA",
            address: process.env.MAILJET_SENDER_EMAIL
        },

        to: booking.email,

        subject:
            "Your Appointment is Confirmed - STENIVA",

        text: text,

        html: html

    });
}

// Health check

app.get("/api/health", function(req, res) {
    res.json({
        message: "STENIVA backend is working!"
    });
});

 // Create a temporary booking hold

app.post("/api/holds", bookingHoldLimiter, function(req, res) {

    const { service, specialist, date, time } = req.body || {};

    // Validate treatment
    if (!Object.hasOwn(services, service)) {
        return res.status(400).json({
            message: "Please select a valid treatment."
        });
    }

    // Validate specialist
    if (
        specialist !== "any" &&
        !Object.hasOwn(specialistNames, specialist)
    ) {
        return res.status(400).json({
            message: "Please select a valid specialist."
        });
    }

    // Validate date
    if (!isValidBookingDate(date)) {
        return res.status(400).json({
            message: "Please select a valid available date."
        });
    }

    // Validate time
    if (!isValidBookingTime(time, services[service].duration)) {
        return res.status(400).json({
            message: "Please select a valid time."
        });
    }

    try {

        const hold = createBookingHold({
            service,
            specialist,
            date,
            time
        });

        if (!hold) {
            return res.status(409).json({
                message: "This time is no longer available."
            });
        }

        return res.status(201).json({
            token: hold.token,
            specialist: hold.specialist,
            expiresAt: hold.expiresAt
        });

    } catch (error) {

        console.error("Booking hold error:", error);

        return res.status(500).json({
            message: "Unable to reserve this time temporarily."
        });
    }
});

 // Release a temporary booking hold

app.delete("/api/holds/:token", function(req, res) {

    const token = req.params.token;

    try {

        db.prepare(`
            DELETE FROM booking_holds
            WHERE token = ?
        `).run(token);

        return res.status(204).end();

    } catch (error) {

        console.error("Release booking hold error:", error);

        return res.status(500).json({
            message: "Unable to release the temporary hold."
        });
    }
});

 // Available appointment times

app.get("/api/availability", function(req, res) {

    const { service, specialist, date } = req.query;

    // Validate service
    if (!Object.hasOwn(services, service)) {
        return res.status(400).json({
            message: "Please select a valid treatment."
        });
    }


    // Validate specialist

if (
    specialist !== "any" &&
    !Object.hasOwn(specialistNames, specialist)
) {
    return res.status(400).json({
        message: "Please select a valid specialist."
    });
}


    // Validate booking date
    if (!isValidBookingDate(date)) {

        return res.status(400).json({
            message: "Please select a valid available date."
        });
    }
    
    

    const selectedService = services[service];


    const availableTimes = [];

    // Generate half-hour slots
    for (let hour = 9; hour < 18; hour++) {

        for (
            let minute = 0;
            minute < 60;
            minute += 30
        ) {

            const time =
                String(hour).padStart(2, "0") +
                ":" +
                String(minute).padStart(2, "0");

            if (!isValidBookingTime(
                time,
                selectedService.duration
            )) {
                continue;
            }


const available = specialist === "any"
    ? Object.keys(specialistNames).some(function(name) {

        return (
            isSpecialistAvailable(
                date,
                name,
                time,
                selectedService.duration
            ) &&
            !hasActiveHoldConflict(
                date,
                name,
                time,
                selectedService.duration
            )
        );

    })
    : (
        isSpecialistAvailable(
            date,
            specialist,
            time,
            selectedService.duration
        ) &&
        !hasActiveHoldConflict(
            date,
            specialist,
            time,
            selectedService.duration
        )
    );



            if (available) {
                availableTimes.push(time);
            }
        }
    }

    return res.json({
        service: service,
        specialist: specialist,
        date: date,
        availableTimes: availableTimes
    });

});

// Create booking

app.post("/api/bookings", async function(req, res) {

    const bookingData = req.body || {};

    // Validate treatment

    if (!Object.hasOwn(
        services,
        bookingData.service
    )) {

        return res.status(400).json({
            message: "Please select a valid treatment."
        });
    }

    const selectedService =
        services[bookingData.service];

    // Validate specialist

if (
    bookingData.specialist !== "any" &&
    !Object.hasOwn(
        specialistNames,
        bookingData.specialist
    )
) {
    return res.status(400).json({
        message: "Please select a valid specialist."
    });
}


    // Validate date

    if (!isValidBookingDate(bookingData.date)) {

        return res.status(400).json({
            message: "Please select a valid available date."
        });
    }

    // Validate time

    if (!isValidBookingTime(
        bookingData.time,
        selectedService.duration
    )) {

        return res.status(400).json({
            message: "Please select a valid time within working hours."
        });
    }

    // Validate customer details

    const firstName = bookingData.firstName;
    const lastName = bookingData.lastName;
    const email = bookingData.email;

    if (
        typeof firstName !== "string" ||
        !firstName.trim() ||

        typeof lastName !== "string" ||
        !lastName.trim() ||

        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email.trim()
        )
    ) {

        return res.status(400).json({
            message:
                "Please enter a valid first name, last name and email address."
        });
    }

    // Prepare booking data

    const newBooking = {
        service: bookingData.service,
        specialist: bookingData.specialist,
        date: bookingData.date,
        time: bookingData.time,
        duration: selectedService.duration,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim()
    };

    // Save booking

    let result;

    try {

        result = confirmHeldBooking(newBooking, bookingData.holdToken);

    } catch (error) {

        console.error("Booking error:", error);

        return res.status(500).json({
            message:
                "Unable to save your booking. Please try again."
        });
    }

    // Reject unavailable slots

    if (!result.success) {

    if (result.reason === "hold_expired") {
        return res.status(409).json({
            code: "HOLD_EXPIRED",
            message:
                "Your 5-minute reservation hold has expired. Please select an available time to continue."
        });
    }

    return res.status(409).json({
        code: "SLOT_UNAVAILABLE",
        message:
            "This time slot is no longer available. Please choose another time."
    });
}

    console.log(
        "Booking saved successfully! ID:",
        result.bookingId
    );

    // Confirmation email delivery

    // Respond before sending the email

res.status(201).json({
    message: "Booking saved successfully.",
    bookingId: result.bookingId,
    specialist: result.specialist
});

    // Send email without blocking the response

    sendConfirmationEmail(newBooking, result.bookingId)
        .then(function(info) {
            console.log(
                "EMAIL SENT for booking #" + result.bookingId
            );
            console.log("Message ID:", info.messageId);
        })
        .catch(function(error) {
            console.error(
                "EMAIL FAILED for booking #" + result.bookingId
            );
            console.error("SMTP error:", error.message);
        });


});

// Admin routes

// Admin page

app.get("/admin", function(req, res) {
    res.sendFile(
        require("path").join(__dirname, "admin.html")
    );
});

// Admin booking API

// Require an authenticated admin session

function requireAdmin(req, res, next) {

    if (!req.session || req.session.isAdmin !== true) {

        return res.status(401).json({
            message: "Unauthorized. Admin login required."
        });
    }

    next();
}

// List bookings

app.get("/api/admin/bookings", requireAdmin, function(req, res) {

    try {

        const bookings = db.prepare(`
            SELECT
                id,
                service,
                specialist,
                date,
                time,
                duration,
                first_name,
                last_name,
                email,
                status,
                created_at
            FROM bookings
            ORDER BY date DESC, time DESC
        `).all();

        res.set("Cache-Control", "no-store");

        return res.json({
            bookings: bookings
        });

    } catch (error) {

        console.error("Admin bookings error:", error);

        return res.status(500).json({
            message: "Unable to load bookings."
        });
    }
});

// Cancel booking

app.patch(
    "/api/admin/bookings/:id/cancel",
    requireAdmin,
    function(req, res) {

        const bookingId = Number(req.params.id);

        // Validate booking ID
        if (
            !Number.isSafeInteger(bookingId) ||
            bookingId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid booking ID."
            });
        }

        try {

            // Fetch the booking

const booking = db.prepare(`
    SELECT
        id,
        status,
        service,
        specialist,
        date,
        time,
        first_name,
        last_name,
        email
    FROM bookings
    WHERE id = ?

`).get(bookingId);



            if (!booking) {
                return res.status(404).json({
                    message: "Booking not found."
                });
            }

            if (booking.status !== "confirmed") {
                return res.status(409).json({
                    message: "This booking is already cancelled."
                });
            }

            // Preserve the booking record when cancelling
            const result = db.prepare(`
                UPDATE bookings
                SET status = 'cancelled'
                WHERE id = ?
                  AND status = 'confirmed'
            `).run(bookingId);

            if (result.changes !== 1) {
                return res.status(409).json({
                    message: "Booking could not be cancelled."
                });
            }

            console.log(
                "Booking #" + bookingId + " cancelled."
            );

// Confirm cancellation

res.set("Cache-Control", "no-store");

res.json({
    message: "Booking cancelled successfully.",
    bookingId: bookingId,
    status: "cancelled"
});

// Send cancellation email

if (mailTransport) {

    const treatment =
        services[booking.service]?.name || booking.service;

    const specialist =
        specialistNames[booking.specialist] ||
        booking.specialist;

    const date = formatDateEnglish(booking.date);

    const message = `
Dear ${booking.first_name},

Your appointment at STENIVA has been cancelled.

Treatment: ${treatment}
Specialist: ${specialist}
Date: ${date}
Time: ${booking.time}
Booking reference: #${booking.id}

If you would like to book another appointment,
please visit our booking page.

With care,
The STENIVA Team
    `.trim();

    const html = `
        <div style="background:#F7F3ED; padding:35px 15px;
                    font-family:Arial,sans-serif; color:#33352E;">
            <div style="max-width:520px; margin:auto;
                        background:#FFFFFF; padding:35px;
                        border-radius:12px;">

                <h2 style="text-align:center; letter-spacing:5px;
                           color:#A88B6D;">STENIVA</h2>

                <h1 style="font-family:Georgia,serif;
                           font-weight:normal; text-align:center;">
                    Appointment Cancelled
                </h1>

                <p>Dear ${escapeHtml(booking.first_name)},</p>

                <p>Your appointment at STENIVA has been cancelled.</p>

                <div style="background:#F7F3ED; padding:20px;
                            border-radius:8px; line-height:2;">
                    <strong>Treatment:</strong> ${escapeHtml(treatment)}<br>
                    <strong>Specialist:</strong> ${escapeHtml(specialist)}<br>
                    <strong>Date:</strong> ${escapeHtml(date)}<br>
                    <strong>Time:</strong> ${escapeHtml(booking.time)}<br>
                    <strong>Booking reference:</strong> #${booking.id}
                </div>

                <p>We would be happy to welcome you another time.</p>

                <p>With care,<br><strong>The STENIVA Team</strong></p>
            </div>
        </div>
    `;

    mailTransport.sendMail({
        from: {
            name: "STENIVA",
            address: process.env.MAILJET_SENDER_EMAIL
        },
        to: booking.email,
        subject: "Your STENIVA Appointment Has Been Cancelled",
        text: message,
        html: html
    })
    .then(function(info) {
        console.log(
            "CANCELLATION EMAIL SENT for booking #" + booking.id
        );
    })
    .catch(function(error) {
        console.error(
            "CANCELLATION EMAIL FAILED:",
            error.message
        );
    });
}


        } catch (error) {

            console.error(
                "Booking cancellation error:",
                error
            );

            return res.status(500).json({
                message: "Unable to cancel booking."
            });
        }
    }
);

// Admin logout

app.post("/api/admin/logout", requireAdmin, function(req, res) {

    req.session.destroy(function(error) {

        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                message: "Unable to log out."
            });
        }

        res.clearCookie("steniva.sid", {
            path: "/"
        });

        return res.json({
            message: "Logged out successfully."
        });

    });

});

app.listen(PORT, function() {

    console.log(
        "STENIVA server running on http://localhost:" +
        PORT
    );

});
