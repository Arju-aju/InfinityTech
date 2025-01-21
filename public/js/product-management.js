// Product Management Functions
document.addEventListener('DOMContentLoaded', function() {
    // Image Preview Setup
    const imageInputs = document.querySelectorAll('.product-image-input');
    imageInputs.forEach(input => {
        const previewContainer = input.parentElement.querySelector('.image-preview-container');
        if (previewContainer) {
            input.addEventListener('change', function(e) {
                previewContainer.innerHTML = ''; // Clear existing previews
                Array.from(this.files).forEach(file => {
                    if (file) {
                        const reader = new FileReader();
                        const preview = document.createElement('img');
                        preview.className = 'w-32 h-32 object-cover rounded-lg shadow-md';
                        
                        reader.onload = function(e) {
                            preview.src = e.target.result;
                        };
                        
                        reader.readAsDataURL(file);
                        previewContainer.appendChild(preview);
                    }
                });
            });
        }
    });

    // Product Status Toggle
    window.toggleProductStatus = async function(productId, button) {
        try {
            const isActive = button.checked;
            const response = await fetch(`/admin/product/${productId}/toggle-status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ isActive })
            });

            const data = await response.json();
            if (data.success) {
                const productCard = document.querySelector(`[data-product-id="${productId}"]`);
                if (productCard) {
                    productCard.classList.toggle('opacity-50', !isActive);
                    const statusBadge = productCard.querySelector('.status-badge');
                    if (statusBadge) {
                        statusBadge.textContent = isActive ? 'Active' : 'Inactive';
                        statusBadge.classList.toggle('bg-green-100', isActive);
                        statusBadge.classList.toggle('text-green-800', isActive);
                        statusBadge.classList.toggle('bg-red-100', !isActive);
                        statusBadge.classList.toggle('text-red-800', !isActive);
                    }
                }
                showNotification(`Product ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
            } else {
                button.checked = !isActive; // Revert toggle
                showNotification(data.message || 'Failed to update product status', 'error');
            }
        } catch (error) {
            console.error('Error toggling product status:', error);
            button.checked = !button.checked; // Revert toggle
            showNotification('Failed to update product status', 'error');
        }
    };

    // Product Form Validation
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Clear previous error messages
            document.querySelectorAll('.error-message').forEach(el => el.remove());
            
            let isValid = true;
            
            // Validate required fields
            const requiredFields = ['name', 'description', 'price', 'category', 'brand'];
            requiredFields.forEach(field => {
                const input = this.querySelector(`[name="${field}"]`);
                if (!input.value.trim()) {
                    showFieldError(input, `${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
                    isValid = false;
                }
            });
            
            // Validate price
            const priceInput = this.querySelector('[name="price"]');
            if (priceInput && priceInput.value && parseFloat(priceInput.value) <= 0) {
                showFieldError(priceInput, 'Price must be greater than 0');
                isValid = false;
            }
            
            // Validate images
            const imageInput = this.querySelector('[name="images"]');
            if (imageInput && imageInput.files.length === 0) {
                showFieldError(imageInput, 'At least one image is required');
                isValid = false;
            }
            
            if (isValid) {
                this.submit();
            }
        });
    }

    // Helper Functions
    function showFieldError(element, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message text-red-500 text-sm mt-1';
        errorDiv.textContent = message;
        element.parentElement.appendChild(errorDiv);
        element.classList.add('border-red-500');
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
});
