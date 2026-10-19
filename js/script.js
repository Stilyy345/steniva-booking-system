
"use strict";

// Frontend booking system

const API_BASE = "http://localhost:3000";

// Available treatments

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

// Specialist names

const specialistNames = {
    emma: "Emma Wilson",
    sophie: "Sophie Laurent",
    olivia: "Olivia Bennett"
};

// Service shortcuts on the home page

const serviceButtons =
    document.querySelectorAll(".service-button");

serviceButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        const selectedService = button.dataset.service;

        if (services[selectedService]) {

            window.location.href =
                "booking.html?service=" +
                encodeURIComponent(selectedService);
        }

    });

});

// Booking page

const bookingPage =
    document.querySelector(".booking-page");

if (bookingPage) {

    // Form elements

    const serviceSelect =
        document.getElementById("service-select");

    const specialistSelect =
        document.getElementById("specialist-select");

    const bookingDate =
        document.getElementById("booking-date");

    const bookingTime =
        document.getElementById("booking-time");

    const bookingTimeMessage =
        document.getElementById("booking-time-message");

    const bookingServiceName =
        document.getElementById("booking-service-name");

    const bookingServiceDetails =
        document.getElementById("booking-service-details");

    const firstName =
        document.getElementById("first-name");

    const lastName =
        document.getElementById("last-name");

    const email =
        document.getElementById("email");

    const confirmButton =
        document.getElementById("confirm-booking");

    const successSection =
        document.getElementById("booking-success");

    // Check that required elements exist

    const requiredElements = [
        serviceSelect,
        specialistSelect,
        bookingDate,
        bookingTime,
        bookingTimeMessage,
        bookingServiceName,
        bookingServiceDetails,
        firstName,
        lastName,
        email,
        confirmButton,
        successSection,
        document.getElementById("success-name"),
        document.getElementById("success-treatment"),
        document.getElementById("success-specialist"),
        document.getElementById("success-datetime"),
        document.getElementById("success-booking-id")
    ];

    if (requiredElements.some(function(element) {
        return !element;
    })) {

        console.error(
            "STENIVA: Missing booking HTML elements."
        );

        if (confirmButton) {
            confirmButton.disabled = true;
        }

    } else {

        // Booking state

        let isSending = false;
        let isConfirmed = false;
        // Temporary booking hold

let holdToken = null;
let holdExpiresAt = 0;
let holdRequestId = 0;

async function releaseHold(token) {

    if (!token) {
        return;
    }

    try {

        const response = await fetch(
            API_BASE + "/api/holds/" + encodeURIComponent(token),
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            console.warn("Unable to release booking hold.");
        }

    } catch (error) {

        console.warn("Booking hold release failed:", error);
    }
}

 // Update the 5-minute booking countdown

function updateHoldCountdown() {

    if (isConfirmed || !holdToken || isSending) {
        return;
    }

    const secondsLeft = Math.max(
        0,
        Math.ceil((holdExpiresAt - Date.now()) / 1000)
    );

    // The temporary hold has expired
    if (secondsLeft === 0) {

        const expiredToken = holdToken;

        holdToken = null;
        holdExpiresAt = 0;

        ++holdRequestId;

        bookingTime.value = "";

        updateConfirmButton();

        bookingTimeMessage.textContent =
            "Your 5-minute reservation hold has expired. Please select a time again.";

        releaseHold(expiredToken);

        return;
    }

    const minutes = Math.floor(secondsLeft / 60);

    const seconds = String(
        secondsLeft % 60
    ).padStart(2, "0");

    bookingTimeMessage.textContent =
        "Your appointment time is reserved for " +
        minutes + ":" + seconds +
        ". Please complete your booking.";
}

// Refresh the countdown every second
setInterval(updateHoldCountdown, 1000);

        let availabilityRequestId = 0;
        let availabilityController = null;

        const confirmationStorageKey =
            "steniva-confirmed-booking";

        // Date helpers

        function todayString() {

            const today = new Date();

            const year = today.getFullYear();

            const month = String(
                today.getMonth() + 1
            ).padStart(2, "0");

            const day = String(
                today.getDate()
            ).padStart(2, "0");

            return `${year}-${month}-${day}`;
        }

        function isClosedDate(dateValue) {

            const monthAndDay = dateValue.slice(5);

            const closedDates = [
                "12-24",
                "12-25",
                "12-31",
                "01-01"
            ];

            return closedDates.includes(monthAndDay);
        }

        function validBookingDate(dateValue) {

            if (
                !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
                dateValue < todayString()
            ) {
                return false;
            }

            const [year, month, day] =
                dateValue.split("-").map(Number);

            const selectedDate =
                new Date(year, month - 1, day);

            if (
                selectedDate.getFullYear() !== year ||
                selectedDate.getMonth() !== month - 1 ||
                selectedDate.getDate() !== day
            ) {
                return false;
            }

            if (selectedDate.getDay() === 0) {
                return false;
            }

            if (isClosedDate(dateValue)) {
                return false;
            }

            return true;
        }

        function formatDateEnglish(dateValue) {

            const [year, month, day] =
                dateValue.split("-").map(Number);

            const date =
                new Date(year, month - 1, day);

            return new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(date);
        }

        // Treatment details

        function updateTreatmentSummary() {

            const selectedService =
                services[serviceSelect.value];

            if (selectedService) {

                bookingServiceName.textContent =
                    selectedService.name;

                bookingServiceDetails.textContent =
                    selectedService.duration +
                    " minutes · €" +
                    selectedService.price;

            } else {

                bookingServiceName.textContent =
                    "No treatment selected yet.";

                bookingServiceDetails.textContent = "";
            }
        }

        // Customer input validation

        function validCustomerDetails() {

            const first = firstName.value.trim();
            const last = lastName.value.trim();
            const address = email.value.trim();

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            return Boolean(
                first &&
                last &&
                emailPattern.test(address) &&
                email.checkValidity()
            );
        }

        // Confirm button state

        function updateConfirmButton() {

            const validService =
                Boolean(services[serviceSelect.value]);

const validSpecialist =
    specialistSelect.value === "any" ||
    Object.hasOwn(
        specialistNames,
        specialistSelect.value
    );

            const validDate =
                validBookingDate(bookingDate.value);

            const validTime =
    !bookingTime.disabled &&
    Boolean(bookingTime.value) &&
    Boolean(holdToken) &&
    Date.now() < holdExpiresAt;

            const validCustomer =
                validCustomerDetails();

            confirmButton.disabled =
                isSending ||
                isConfirmed ||
                !(
                    validService &&
                    validSpecialist &&
                    validDate &&
                    validTime &&
                    validCustomer
                );
        }

        // Reset available time slots

        function resetTimeOptions(placeholder) {

            bookingTime.replaceChildren(
                new Option(placeholder, "")
            );

            bookingTime.disabled = true;

            updateConfirmButton();
        }

        // Fetch available appointment times

        async function updateAvailableTimes() {

            const requestId = ++availabilityRequestId;

            // Cancel the previous request
            if (availabilityController) {
                availabilityController.abort();
            }

            availabilityController =
                new AbortController();

            resetTimeOptions("Select a time");

            const service = serviceSelect.value;
            const specialist = specialistSelect.value;
            const date = bookingDate.value;

            if (!service || !specialist || !date) {

                bookingTimeMessage.textContent =
                    "Choose a treatment, specialist and date first.";

                return;
            }

            if (!validBookingDate(date)) {

                bookingTimeMessage.textContent =
                    "The studio is closed or this date is unavailable.";

                return;
            }

            bookingTimeMessage.textContent =
                "Checking available times...";

            const params = new URLSearchParams({
                service: service,
                specialist: specialist,
                date: date
            });

            try {

                const response = await fetch(
                    API_BASE +
                    "/api/availability?" +
                    params.toString(),
                    {
                        signal: availabilityController.signal
                    }
                );

                const data = await response.json();

                if (!response.ok) {

                    throw new Error(
                        data.message || "Unable to load times."
                    );
                }

                // Discard stale responses
                if (
                    requestId !== availabilityRequestId ||
                    serviceSelect.value !== service ||
                    specialistSelect.value !== specialist ||
                    bookingDate.value !== date
                ) {
                    return;
                }

                resetTimeOptions("Select a time");

                const availableTimes =
                    Array.isArray(data.availableTimes)
                        ? data.availableTimes
                        : [];

                availableTimes.forEach(function(time) {

                    const option = new Option(time, time);

                    bookingTime.add(option);
                });

                bookingTime.disabled =
                    availableTimes.length === 0;

                if (availableTimes.length > 0) {

                    bookingTimeMessage.textContent =
                        "Select your preferred available time.";

                } else {

                    bookingTimeMessage.textContent =
                        "No available times for this date.";
                }

            } catch (error) {

                if (
                    error.name === "AbortError" ||
                    requestId !== availabilityRequestId
                ) {
                    return;
                }

                console.error(
                    "Availability error:",
                    error
                );

                bookingTimeMessage.textContent =
                    "Unable to load available times. Check that the server is running.";

                resetTimeOptions("Select a time");

            } finally {

                updateConfirmButton();
            }
        }

        // Automatically refresh available times every 15 seconds

        setInterval(function() {

            // Do not interrupt an active booking or selected time
            if (
                isConfirmed ||
                isSending ||
                holdToken ||
                bookingTime.value ||
                document.hidden
            ) {
                return;
            }

            // Refresh only when the booking details are valid
            if (
                !services[serviceSelect.value] ||
                !specialistSelect.value ||
                !validBookingDate(bookingDate.value)
            ) {
                return;
            }

            updateAvailableTimes();

        }, 15000);

        // Booking confirmation

        function displayConfirmation(details) {

            isConfirmed = true;

            document.getElementById(
                "success-name"
            ).textContent =
                details.firstName +
                " " +
                details.lastName;

            document.getElementById(
                "success-treatment"
            ).textContent =
                "Treatment: " +
                services[details.service].name;

            document.getElementById(
                "success-specialist"
            ).textContent =
                "Specialist: " +
                specialistNames[details.specialist];

            document.getElementById(
                "success-datetime"
            ).textContent =
                "Date & Time: " +
                formatDateEnglish(details.date) +
                " at " +
                details.time;

            document.getElementById(
                "success-booking-id"
            ).textContent =
                "Booking reference: #" +
                details.bookingId;

            // Replace the booking form with the confirmation
            const bookingSections =
                bookingPage.querySelectorAll(
                    ".booking-intro, " +
                    ".booking-selection, " +
                    ".booking-specialist, " +
                    ".booking-datetime, " +
                    ".booking-details, " +
                    ".booking-confirmation"
                );

            bookingSections.forEach(function(section) {
                section.hidden = true;
            });

            successSection.hidden = false;

            confirmButton.disabled = true;

            successSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        // Preserve confirmation on reload

        const navigation =
            performance.getEntriesByType("navigation")[0];

        // Start a fresh booking on new navigation
        if (
            navigation &&
            navigation.type !== "reload"
        ) {

            try {
                sessionStorage.removeItem(
                    confirmationStorageKey
                );
            } catch (error) {
                // Continue if session storage is unavailable
            }
        }

        let restored = false;

        try {

            const stored = JSON.parse(
                sessionStorage.getItem(
                    confirmationStorageKey
                ) || "null"
            );

            if (
                stored &&
                stored.bookingId &&
                services[stored.service] &&
                specialistNames[stored.specialist] &&
                stored.date &&
                stored.time &&
                stored.firstName &&
                stored.lastName
            ) {

                displayConfirmation(stored);

                restored = true;
            }

        } catch (error) {
            // Continue if session storage is unavailable
        }

        // Disable native form submission

        bookingPage.addEventListener(
            "submit",
            function(event) {
                event.preventDefault();
            }
        );

        // Form event handlers
        
function clearSelectedHold() {

    // Invalidate any pending hold request
    ++holdRequestId;

    const previousToken = holdToken;

    holdToken = null;
    holdExpiresAt = 0;

    // Release the old appointment time
    if (previousToken) {
        releaseHold(previousToken);
    }

    updateConfirmButton();
}

// Release the hold when treatment, specialist or date changes
[serviceSelect, specialistSelect, bookingDate].forEach(function(field) {

    field.addEventListener("change", clearSelectedHold);

});


        serviceSelect.addEventListener(
            "change",
            function() {

                updateTreatmentSummary();
                updateAvailableTimes();
            }
        );

        specialistSelect.addEventListener(
            "change",
            updateAvailableTimes
        );

        bookingDate.addEventListener(
            "change",
            function() {

                if (
                    bookingDate.value &&
                    !validBookingDate(bookingDate.value)
                ) {

                    bookingTimeMessage.textContent =
                        "Please choose a future working day.";

                    bookingDate.value = "";
                }

                updateAvailableTimes();
            }
        );

        

bookingTime.addEventListener("change", async function() {

    const requestId = ++holdRequestId;

    const previousToken = holdToken;

    holdToken = null;
    holdExpiresAt = 0;

    // Release the previously selected time
    if (previousToken) {
        releaseHold(previousToken);
    }

    updateConfirmButton();


    const service = serviceSelect.value;
    const specialist = specialistSelect.value;
    const date = bookingDate.value;
    const time = bookingTime.value;

    if (!time) {
        return;
    }

    bookingTimeMessage.textContent =
        "Temporarily reserving your selected time...";

    try {

        const response = await fetch(
            API_BASE + "/api/holds",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    service,
                    specialist,
                    date,
                    time
                })
            }
        );

        const result = await response.json();

        // Ignore responses for an outdated selection
        
if (
    requestId !== holdRequestId ||
    serviceSelect.value !== service ||
    specialistSelect.value !== specialist ||
    bookingDate.value !== date ||
    bookingTime.value !== time
) {

    // Release a hold created for an outdated selection
    if (response.ok && result.token) {
        releaseHold(result.token);
    }

    return;
}


        if (!response.ok) {

            bookingTimeMessage.textContent =
                result.message ||
                "This time is no longer available.";

            await updateAvailableTimes();
            return;
        }

        holdToken = result.token;
        holdExpiresAt = result.expiresAt;

        bookingTimeMessage.textContent =
            "Your appointment time is held for 5 minutes. Please complete your booking.";

    } catch (error) {

        if (requestId !== holdRequestId) {
            return;
        }

        console.error("Booking hold error:", error);

        bookingTimeMessage.textContent =
            "Unable to hold this time. Please try again.";

    } finally {

        updateConfirmButton();
    }
});


        [firstName, lastName, email].forEach(
            function(field) {

                field.addEventListener(
                    "input",
                    updateConfirmButton
                );

                field.addEventListener(
                    "change",
                    updateConfirmButton
                );
            }
        );

        // Submit booking

        confirmButton.addEventListener(
            "click",
            async function(event) {

                event.preventDefault();
                event.stopPropagation();

                if (isSending || isConfirmed) {
                    return;
                }

                updateConfirmButton();

                if (confirmButton.disabled) {
                    return;
                }

                const bookingData = {
                    service: serviceSelect.value,
                    specialist: specialistSelect.value,
                    date: bookingDate.value,
                    time: bookingTime.value,
                    firstName: firstName.value.trim(),
                    lastName: lastName.value.trim(),
                    email: email.value.trim()
                };

                isSending = true;

                confirmButton.textContent =
                    "Processing booking...";

                updateConfirmButton();

                try {

                    const response = await fetch(
                        API_BASE + "/api/bookings",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
    ...bookingData,
    holdToken: holdToken
})
                        }
                    );

                    const result = await response.json();

                    if (!response.ok) {

                        if (response.status === 409) {
                            await updateAvailableTimes();
                        }

                        alert(
                            result.message ||
                            "Unable to complete booking."
                        );

                        return;
                    }

                    if (!result.bookingId) {

                        alert(
                            "Booking response is incomplete. Please contact the studio before retrying."
                        );

                        return;
                    }

const confirmed = {
    ...bookingData,
    specialist: result.specialist,
    bookingId: result.bookingId
};

                    // Remember the confirmation for page reloads
                    try {

                        sessionStorage.setItem(
                            confirmationStorageKey,
                            JSON.stringify(confirmed)
                        );

                    } catch (error) {
                        // Booking can continue without session storage
                    }

                    displayConfirmation(confirmed);

                } catch (error) {

                    console.error(
                        "Booking request failed:",
                        error
                    );

                    alert(
                        "Could not verify the booking result. Please check with the studio before trying again."
                    );

                } finally {

                    isSending = false;

                    confirmButton.textContent =
                        "Confirm Booking";

                    updateConfirmButton();
                }
            }
        );

        // Initialize booking page

        bookingDate.min = todayString();

// Date picker

if (typeof flatpickr === "function") {

    flatpickr(bookingDate, {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "j F Y",
        minDate: todayString(),
        disableMobile: true,
        monthSelectorType: "dropdown",

        locale: {
            firstDayOfWeek: 1
        },

        disable: [
            function(date) {

                const month = String(
                    date.getMonth() + 1
                ).padStart(2, "0");

                const day = String(
                    date.getDate()
                ).padStart(2, "0");

                const closedDates = [
                    "12-24",
                    "12-25",
                    "12-31",
                    "01-01"
                ];

                return (
                    date.getDay() === 0 ||
                    closedDates.includes(month + "-" + day)
                );
            }
        ]
    });
}

        // Preselect a treatment from the URL
        const preselectedService =
            new URLSearchParams(
                window.location.search
            ).get("service");

        if (services[preselectedService]) {

            serviceSelect.value =
                preselectedService;
        }

        updateTreatmentSummary();

        if (!restored) {
            updateAvailableTimes();
        }

        updateConfirmButton();
    }
}

// Mobile navigation

(function () {

    const menuButton =
        document.getElementById("mobile-menu-toggle");

    const mobileNav =
        document.getElementById("main-navigation");

    if (!menuButton || !mobileNav) {
        return;
    }

    menuButton.addEventListener("click", function () {

        const isOpen =
            mobileNav.classList.toggle("is-open");

        menuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        menuButton.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );

    });

    // Close the menu after navigation
    mobileNav.querySelectorAll("a").forEach(function (link) {

        link.addEventListener("click", function () {

            mobileNav.classList.remove("is-open");

            menuButton.setAttribute("aria-expanded", "false");

            menuButton.setAttribute(
                "aria-label",
                "Open navigation menu"
            );

        });

    });

})();

// Treatment dropdown

(function () {

    const originalSelect =
        document.getElementById("service-select");

    if (!originalSelect) {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "steniva-custom-dropdown";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "steniva-dropdown-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Choose your treatment");

    const menu = document.createElement("div");
    menu.className = "steniva-dropdown-menu";
    menu.hidden = true;

    function closeMenu() {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    }

    function renderOptions() {

        menu.replaceChildren();

        const selected =
            originalSelect.selectedOptions[0];

        trigger.textContent =
            selected ? selected.textContent : "Choose a treatment";

        Array.from(originalSelect.options).forEach(function(option) {

            const item = document.createElement("button");
            item.type = "button";
            item.className = "steniva-dropdown-option";
            item.textContent = option.textContent;

            if (option.selected) {
                item.classList.add("is-selected");
            }

            item.addEventListener("click", function() {

                originalSelect.value = option.value;

                originalSelect.dispatchEvent(
                    new Event("change", { bubbles: true })
                );

                renderOptions();
                closeMenu();
                trigger.focus();
            });

            menu.appendChild(item);
        });
    }

    wrapper.append(trigger, menu);

    originalSelect.insertAdjacentElement(
        "afterend",
        wrapper
    );

    originalSelect.classList.add(
        "steniva-original-select-hidden"
    );

    originalSelect.tabIndex = -1;
    originalSelect.setAttribute("aria-hidden", "true");

    renderOptions();

    trigger.addEventListener("click", function() {

        const opening = menu.hidden;

        menu.hidden = !opening;

        trigger.setAttribute(
            "aria-expanded",
            String(opening)
        );
    });

    document.addEventListener("click", function(event) {

        if (!wrapper.contains(event.target)) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", function(event) {

        if (event.key === "Escape" && !menu.hidden) {
            closeMenu();
            trigger.focus();
        }
    });

    originalSelect.addEventListener(
        "change",
        renderOptions
    );

})();

// Specialist dropdown

(function () {

    const originalSelect =
        document.getElementById("specialist-select");

    if (!originalSelect) {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "steniva-custom-dropdown";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "steniva-dropdown-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Choose your specialist");

    const menu = document.createElement("div");
    menu.className = "steniva-dropdown-menu";
    menu.hidden = true;

    function closeMenu() {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    }

    function renderOptions() {

        menu.replaceChildren();

        const selected = originalSelect.selectedOptions[0];

        trigger.textContent =
            selected ? selected.textContent : "Choose a specialist";

        Array.from(originalSelect.options).forEach(function(option) {

            const item = document.createElement("button");
            item.type = "button";
            item.className = "steniva-dropdown-option";
            item.textContent = option.textContent;

            if (option.selected) {
                item.classList.add("is-selected");
            }

            item.addEventListener("click", function() {

                originalSelect.value = option.value;

                originalSelect.dispatchEvent(
                    new Event("change", { bubbles: true })
                );

                renderOptions();
                closeMenu();
                trigger.focus();
            });

            menu.appendChild(item);
        });
    }

    wrapper.append(trigger, menu);

    originalSelect.insertAdjacentElement(
        "afterend",
        wrapper
    );

    originalSelect.classList.add(
        "steniva-original-select-hidden"
    );

    originalSelect.tabIndex = -1;
    originalSelect.setAttribute("aria-hidden", "true");

    renderOptions();

    trigger.addEventListener("click", function() {

        const opening = menu.hidden;

        menu.hidden = !opening;

        trigger.setAttribute(
            "aria-expanded",
            String(opening)
        );
    });

    document.addEventListener("click", function(event) {

        if (!wrapper.contains(event.target)) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", function(event) {

        if (event.key === "Escape" && !menu.hidden) {
            closeMenu();
            trigger.focus();
        }
    });

    originalSelect.addEventListener(
        "change",
        renderOptions
    );

})();

// Time dropdown

(function () {

    const originalSelect =
        document.getElementById("booking-time");

    if (!originalSelect) return;

    const wrapper = document.createElement("div");
    wrapper.className =
        "steniva-custom-dropdown steniva-time-dropdown";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "steniva-dropdown-trigger";
    trigger.setAttribute("aria-label", "Choose appointment time");
    trigger.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "steniva-dropdown-menu";
    menu.hidden = true;

    function closeMenu() {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    }

    function renderOptions() {

        menu.replaceChildren();

        const selected = originalSelect.selectedOptions[0];

        trigger.textContent =
            selected ? selected.textContent : "Select a time";

        trigger.disabled = originalSelect.disabled;

        if (trigger.disabled) {
            closeMenu();
        }

        Array.from(originalSelect.options).forEach(function(option) {

            if (!option.value || option.disabled) return;

            const item = document.createElement("button");
            item.type = "button";
            item.className = "steniva-dropdown-option";
            item.textContent = option.textContent;

            if (option.selected) {
                item.classList.add("is-selected");
            }

            item.addEventListener("click", function() {

                originalSelect.value = option.value;

                originalSelect.dispatchEvent(
                    new Event("change", { bubbles: true })
                );

                renderOptions();
                closeMenu();
                trigger.focus();
            });

            menu.appendChild(item);
        });
    }

    wrapper.append(trigger, menu);

    originalSelect.insertAdjacentElement(
        "afterend",
        wrapper
    );

    originalSelect.classList.add(
        "steniva-original-select-hidden"
    );

    originalSelect.tabIndex = -1;
    originalSelect.setAttribute("aria-hidden", "true");

    trigger.addEventListener("click", function() {

        const opening = menu.hidden;

        menu.hidden = !opening;

        trigger.setAttribute(
            "aria-expanded",
            String(opening)
        );
    });

    document.addEventListener("click", function(event) {

        if (!wrapper.contains(event.target)) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", function(event) {

        if (event.key === "Escape" && !menu.hidden) {
            closeMenu();
            trigger.focus();
        }
    });

    originalSelect.addEventListener(
        "change",
        renderOptions
    );

    // Refresh the dropdown when available slots change
    const observer = new MutationObserver(renderOptions);

    observer.observe(originalSelect, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled"]
    });

    renderOptions();

})();

// Live booking summary

(function () {

    const bookingPage =
        document.querySelector(".booking-page");

    if (!bookingPage) return;

    const serviceSelect =
        document.getElementById("service-select");

    const specialistSelect =
        document.getElementById("specialist-select");

    const bookingDate =
        document.getElementById("booking-date");

    const bookingTime =
        document.getElementById("booking-time");

    const reviewTreatment =
        document.getElementById("review-treatment");

    const reviewSpecialist =
        document.getElementById("review-specialist");

    const reviewDate =
        document.getElementById("review-date");

    const reviewTime =
        document.getElementById("review-time");

    if (
        !reviewTreatment ||
        !reviewSpecialist ||
        !reviewDate ||
        !reviewTime
    ) {
        return;
    }

    function updateBookingReview() {

        const treatment =
            services[serviceSelect.value];

        reviewTreatment.textContent = treatment
            ? treatment.name
            : "—";

        reviewSpecialist.textContent =
            specialistSelect.value === "any"
                ? "No preference"
                : specialistNames[specialistSelect.value] || "—";

        const selectedDate = bookingDate.value;

        if (selectedDate) {

            const [year, month, day] =
                selectedDate.split("-").map(Number);

            const date = new Date(
                year,
                month - 1,
                day
            );

            reviewDate.textContent =
                date.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });

        } else {

            reviewDate.textContent = "—";

        }

        reviewTime.textContent =
            bookingTime.value || "—";

    }

    // Update the summary when selections change

    [
        serviceSelect,
        specialistSelect,
        bookingDate,
        bookingTime
    ].forEach(function(field) {

        field.addEventListener(
            "change",
            updateBookingReview
        );

    });

    updateBookingReview();

})();
