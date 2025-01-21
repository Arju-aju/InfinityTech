// Handle form validation and image management
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('editProductForm');
    
    // Only proceed if we're on the edit product page
    if (!form) return;

    const originalValues = {};
    const requiredFields = ['name', 'brand', 'description', 'price', 'stock', 'category'];
    const numericFields = ['price', 'stock', 'discountPercentage'];
    
    // Store original values for comparison
    requiredFields.concat(numericFields).forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            originalValues[field] = input.value;
        }
    });

    // Store original specifications
    ['processor', 'ram', 'storage', 'graphics'].forEach(spec => {
        const input = document.getElementById(spec);
        if (input) {
            originalValues[`spec_${spec}`] = input.value;
        }
    });

    // Validate form before submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        let isValid = true;
        let firstError = null;
        let hasChanges = false;

        // Check for any changes in main fields
        requiredFields.concat(numericFields).forEach(field => {
            const input = document.getElementById(field);
            if (input && input.value !== originalValues[field]) {
                hasChanges = true;
            }
        });

        // Check for changes in specifications
        ['processor', 'ram', 'storage', 'graphics'].forEach(spec => {
            const input = document.getElementById(spec);
            if (input && input.value !== originalValues[`spec_${spec}`]) {
                hasChanges = true;
            }
        });

        // Check if new images were added
        const newImages = document.getElementById('images')?.files;
        if (newImages && newImages.length > 0) {
            hasChanges = true;
        }

        if (!hasChanges) {
            Swal.fire({
                icon: 'info',
                title: 'No Changes Detected',
                text: 'Please make some changes before updating the product.'
            });
            return false;
        }

        // Validate required fields
        requiredFields.forEach(field => {
            const input = document.getElementById(field);
            if (!input) return;
            
            const errorDiv = input.nextElementSibling;
            if (!errorDiv) return;
            
            if (!input.value.trim()) {
                isValid = false;
                errorDiv.textContent = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
                if (!firstError) firstError = input;
            } else {
                errorDiv.textContent = '';
            }
        });

        // Validate numeric fields
        numericFields.forEach(field => {
            const input = document.getElementById(field);
            if (!input) return;
            
            const errorDiv = input.nextElementSibling;
            if (!errorDiv) return;
            
            const value = parseFloat(input.value);

            if (input.value && (isNaN(value) || value < 0)) {
                isValid = false;
                errorDiv.textContent = `${field.charAt(0).toUpperCase() + field.slice(1)} must be a positive number`;
                if (!firstError) firstError = input;
            }
        });

        // Validate discount percentage
        const discountInput = document.getElementById('discountPercentage');
        if (discountInput) {
            const errorDiv = discountInput.nextElementSibling;
            if (errorDiv && discountInput.value) {
                const discount = parseFloat(discountInput.value);
                if (discount < 0 || discount > 100) {
                    isValid = false;
                    errorDiv.textContent = 'Discount must be between 0 and 100';
                    if (!firstError) firstError = discountInput;
                }
            }
        }

        if (!isValid) {
            if (firstError) firstError.focus();
            return false;
        }

        // Submit form if valid
        try {
            const formData = new FormData(form);
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: result.message,
                    showConfirmButton: false,
                    timer: 1500
                }).then(() => {
                    window.location.href = '/admin/products';
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: error.message || 'Failed to update product'
            });
        }
    });

    // Preview new images before upload
    function previewNewImages(input) {
        const previewContainer = document.getElementById('newImagePreview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';
        const files = Array.from(input.files);

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Invalid File',
                    text: 'Please upload only image files'
                });
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                Swal.fire({
                    icon: 'error',
                    title: 'File Too Large',
                    text: 'Image size should not exceed 5MB'
                });
                return;
            }

            const reader = new FileReader();
            const previewDiv = document.createElement('div');
            previewDiv.className = 'relative group';

            reader.onload = function(e) {
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" alt="Preview" class="w-full h-40 object-cover rounded-lg border border-gray-700">
                    <button type="button" class="absolute top-2 right-2 p-2 bg-red-500/80 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                `;

                const removeButton = previewDiv.querySelector('button');
                removeButton.addEventListener('click', () => {
                    previewDiv.remove();
                    // Remove file from input
                    const dt = new DataTransfer();
                    const { files } = input;
                    for (let i = 0; i < files.length; i++) {
                        if (files[i] !== file) {
                            dt.items.add(files[i]);
                        }
                    }
                    input.files = dt.files;
                });
            };

            reader.readAsDataURL(file);
            previewContainer.appendChild(previewDiv);
        });
    }

    // Make previewNewImages available globally
    window.previewNewImages = previewNewImages;
});

// Handle image deletion
async function deleteImage(productId, imagePath, element) {
    try {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to recover this image!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (!result.isConfirmed) return;

        const response = await fetch(`/admin/product/deleteImage/${productId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ imagePath })
        });

        const data = await response.json();

        if (data.success) {
            element.closest('.relative').remove();
            Swal.fire({
                icon: 'success',
                title: 'Deleted!',
                text: 'Image has been deleted.',
                showConfirmButton: false,
                timer: 1500
            });
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'Failed to delete image'
        });
    }
}

// Handle product deletion
function confirmDelete(productId) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = `/admin/deleteProduct/${productId}`;
        }
    });
}
