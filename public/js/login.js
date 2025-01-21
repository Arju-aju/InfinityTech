document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.success) {
                    window.location.href = data.redirect;
                } else {
                    if (data.blocked) {
                        // Show blocked user message using SweetAlert
                        Swal.fire({
                            icon: 'error',
                            title: 'Account Blocked',
                            text: 'Your account has been blocked. Please contact support.',
                            confirmButtonColor: '#d33',
                            confirmButtonText: 'OK'
                        });
                    } else {
                        // Show other error messages
                        const errorMessage = data.errors ? data.errors[0].msg : 'Login failed';
                        Swal.fire({
                            icon: 'error',
                            title: 'Login Failed',
                            text: errorMessage,
                            confirmButtonColor: '#3085d6',
                            confirmButtonText: 'Try Again'
                        });
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred. Please try again later.',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'OK'
                });
            }
        });
    }
});
