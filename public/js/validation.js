// Form validation helper functions
const showError = (element, message) => {
    const parent = element.parentElement;
    const errorDiv = parent.querySelector('.error-message') || document.createElement('div');
    errorDiv.className = 'error-message text-red-500 text-sm mt-1';
    errorDiv.textContent = message;
    if (!parent.querySelector('.error-message')) {
        parent.appendChild(errorDiv);
    }
    element.classList.add('border-red-500');
};

const clearError = (element) => {
    const parent = element.parentElement;
    const errorDiv = parent.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
    element.classList.remove('border-red-500');
};

// Validation rules
const validationRules = {
    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Please enter a valid email address'
    },
    password: {
        pattern: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/,
        message: 'Password must contain at least 8 characters, including uppercase, lowercase, number and special character'
    },
    name: {
        pattern: /^[a-zA-Z\s]{2,}$/,
        message: 'Name must contain at least 2 characters and only letters'
    },
    phone: {
        pattern: /^\d{10}$/,
        message: 'Please enter a valid 10-digit phone number'
    }
};

// Form validation functions
const validateLoginForm = (form) => {
    let isValid = true;
    const email = form.querySelector('#email');
    const password = form.querySelector('#password');

    // Validate email
    if (!validationRules.email.pattern.test(email.value)) {
        showError(email, validationRules.email.message);
        isValid = false;
    } else {
        clearError(email);
    }

    // Validate password
    if (!password.value) {
        showError(password, 'Password is required');
        isValid = false;
    } else {
        clearError(password);
    }

    return isValid;
};

const validateSignupForm = (form) => {
    let isValid = true;
    const email = form.querySelector('#email');
    const password = form.querySelector('#password');
    const name = form.querySelector('#name');
    const phone = form.querySelector('#phone');

    // Validate all fields
    if (!validationRules.email.pattern.test(email.value)) {
        showError(email, validationRules.email.message);
        isValid = false;
    } else {
        clearError(email);
    }

    if (!validationRules.password.pattern.test(password.value)) {
        showError(password, validationRules.password.message);
        isValid = false;
    } else {
        clearError(password);
    }

    if (!validationRules.name.pattern.test(name.value)) {
        showError(name, validationRules.name.message);
        isValid = false;
    } else {
        clearError(name);
    }

    if (!validationRules.phone.pattern.test(phone.value)) {
        showError(phone, validationRules.phone.message);
        isValid = false;
    } else {
        clearError(phone);
    }

    return isValid;
};

// Image preview functionality
const setupImagePreview = (inputElement, previewElement) => {
    inputElement.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewElement.src = e.target.result;
                previewElement.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    });
};

// Category and Product Status Toggle
const setupStatusToggle = (toggleElement, itemId, type) => {
    toggleElement.addEventListener('change', async function() {
        const isActive = this.checked;
        try {
            const response = await fetch(`/admin/${type}/${itemId}/toggle-status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ isActive })
            });
            
            const data = await response.json();
            if (!data.success) {
                // Revert toggle if failed
                this.checked = !isActive;
                alert(data.message || `Failed to update ${type} status`);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            this.checked = !isActive;
            alert(`Failed to update ${type} status`);
        }
    });
};
