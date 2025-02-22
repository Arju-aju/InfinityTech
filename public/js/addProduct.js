document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('addProductForm');
    const imageInput = document.getElementById('images');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const priceInput = document.getElementById('price');
    const discountPercentageInput = document.getElementById('discountPercentage');
    const originalPriceSpan = document.getElementById('originalPrice');
    const discountAmountSpan = document.getElementById('discountAmount');
    const finalPriceSpan = document.getElementById('finalPrice');
    const nameInput = document.getElementById('name');
    const descriptionInput = document.getElementById('description');
    const brandInput = document.getElementById('brand');
    const stockInput = document.getElementById('stock');

    // Image Preview Functionality
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            imagePreviewContainer.innerHTML = ''; // Clear existing previews
            
            const files = Array.from(this.files);
            if (files.length === 0) {
                showError(imageInput, 'At least one image is required');
                return;
            }
            
            files.forEach(file => {
                if (file) {
                    // Validate file type
                    if (!file.type.match('image.*')) {
                        showError(imageInput, 'Please select only image files (PNG, JPG, JPEG, avif)');
                        return;
                    }

                    // Validate file size (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        showError(imageInput, 'Image size should not exceed 5MB');
                        return;
                    }

                    const reader = new FileReader();
                    const previewDiv = document.createElement('div');
                    previewDiv.className = 'relative group';
                    
                    const preview = document.createElement('img');
                    preview.className = 'w-32 h-32 object-cover rounded-lg shadow-lg';
                    
                    const removeButton = document.createElement('button');
                    removeButton.className = 'absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity';
                    removeButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
                    
                    removeButton.onclick = function(e) {
                        e.preventDefault();
                        previewDiv.remove();
                        
                        // Create a new FileList without the removed image
                        const dt = new DataTransfer();
                        const remainingFiles = Array.from(imageInput.files).filter(f => f !== file);
                        remainingFiles.forEach(f => dt.items.add(f));
                        imageInput.files = dt.files;
                        
                        if (imageInput.files.length === 0) {
                            showError(imageInput, 'At least one image is required');
                        }
                    };
                    
                    reader.onload = function(e) {
                        preview.src = e.target.result;
                    };
                    
                    reader.readAsDataURL(file);
                    previewDiv.appendChild(preview);
                    previewDiv.appendChild(removeButton);
                    imagePreviewContainer.appendChild(previewDiv);
                }
            });
        });
    }

    // Calculate and display prices
    function updatePriceCalculations() {
        const price = parseFloat(priceInput.value) || 0;
        const discountPercentage = parseFloat(discountPercentageInput.value) || 0;
        
        if (price > 0) {
            originalPriceSpan.textContent = '₹' + price.toFixed(2);
            
            if (discountPercentage > 0) {
                if (discountPercentage > 100) {
                    showError(discountPercentageInput, 'Discount percentage cannot exceed 100%');
                    discountPercentageInput.value = '';
                    discountAmountSpan.textContent = '₹0.00';
                    finalPriceSpan.textContent = '₹' + price.toFixed(2);
                    return;
                }
                
                const discountAmount = (price * discountPercentage) / 100;
                const finalPrice = price - discountAmount;
                
                discountAmountSpan.textContent = '₹' + discountAmount.toFixed(2);
                finalPriceSpan.textContent = '₹' + finalPrice.toFixed(2);
            } else {
                discountAmountSpan.textContent = '₹0.00';
                finalPriceSpan.textContent = '₹' + price.toFixed(2);
            }
        } else {
            originalPriceSpan.textContent = '₹0.00';
            discountAmountSpan.textContent = '₹0.00';
            finalPriceSpan.textContent = '₹0.00';
        }
    }

    if (priceInput && discountPercentageInput) {
        priceInput.addEventListener('input', updatePriceCalculations);
        discountPercentageInput.addEventListener('input', updatePriceCalculations);
    }

    // Form Validation
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Client-side validation
            const requiredFields = {
                name: 'Product name',
                description: 'Description',
                brand: 'Brand',
                stock: 'Stock quantity',
                price: 'Price',
                category: 'Category'
            };

            const errors = [];
            
            // Check required fields
            for (const [field, label] of Object.entries(requiredFields)) {
                const input = this.elements[field];
                if (!input.value.trim()) {
                    errors.push(`${label} is required`);
                }
            }

            // Validate price and stock
            const price = parseFloat(this.elements.price.value);
            const stock = parseInt(this.elements.stock.value);
            const discountPercentage = parseFloat(this.elements.discountPercentage.value || 0);

            if (isNaN(price) || price <= 0) {
                errors.push('Price must be a positive number');
            }
            if (isNaN(stock) || stock < 0) {
                errors.push('Stock must be a non-negative number');
            }
            if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
                errors.push('Discount percentage must be between 0 and 100');
            }

            // Validate file input
            const fileInput = this.elements.images;
            const files = fileInput.files;
            
            if (files.length === 0) {
                errors.push('At least one product image is required');
            } else {
                const maxSize = 5 * 1024 * 1024; // 5MB
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp','image/avif '];
                
                for (const file of files) {
                    if (!allowedTypes.includes(file.type)) {
                        errors.push(`File "${file.name}" is not a supported image type`);
                    }
                    if (file.size > maxSize) {
                        errors.push(`File "${file.name}" exceeds 5MB size limit`);
                    }
                }
            }

            // Show errors if any
            if (errors.length > 0) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    html: errors.join('<br>'),
                    confirmButtonColor: '#3085d6'
                });
                return;
            }

            // Calculate and display discount
            if (price && discountPercentage) {
                const discountAmount = (price * discountPercentage) / 100;
                const finalPrice = price - discountAmount;
                
                document.getElementById('discountAmount').textContent = discountAmount.toFixed(2);
                document.getElementById('finalPrice').textContent = finalPrice.toFixed(2);
            }

            try {
                const formData = new FormData(this);
                const response = await fetch('/admin/addProduct', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Failed to add product');
                }

                // Show success message
                await Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Product added successfully',
                    confirmButtonColor: '#3085d6'
                });

                // Redirect to products page
                window.location.href = '/admin/products';
            } catch (error) {
                console.error('Error:', error);
                await Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Failed to add product. Please try again.',
                    confirmButtonColor: '#3085d6'
                });
            }
        });
    }

    // Helper Functions
    function showError(element, message) {
        const errorDiv = element.parentElement.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            element.classList.add('border-red-500');
            element.classList.remove('border-gray-700');
        }
    }

    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(div => div.textContent = '');
        document.querySelectorAll('input, textarea, select').forEach(element => {
            element.classList.remove('border-red-500');
            element.classList.add('border-gray-700');
        });
    }
});

// Preview uploaded images
document.getElementById('images').addEventListener('change', function(e) {
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = '';
    
    const files = e.target.files;
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.createElement('div');
            preview.className = 'relative w-24 h-24 mr-2 mb-2';
            preview.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover rounded-lg">
                <button type="button" class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center -mt-2 -mr-2">&times;</button>
            `;
            
            // Remove image on click
            preview.querySelector('button').onclick = function() {
                preview.remove();
                // Update the file input
                const dt = new DataTransfer();
                const input = document.getElementById('images');
                for (const file of input.files) {
                    if (file !== files[Array.from(previewContainer.children).indexOf(preview)]) {
                        dt.items.add(file);
                    }
                }
                input.files = dt.files;
            };
            
            previewContainer.appendChild(preview);
        };
        reader.readAsDataURL(file);
    }
});

// Calculate and display discount on input change
document.getElementById('price').addEventListener('input', updateDiscount);
document.getElementById('discountPercentage').addEventListener('input', updateDiscount);

function updateDiscount() {
    const price = parseFloat(document.getElementById('price').value) || 0;
    const discountPercentage = parseFloat(document.getElementById('discountPercentage').value) || 0;
    
    const discountAmount = (price * discountPercentage) / 100;
    const finalPrice = price - discountAmount;
    
    document.getElementById('discountAmount').textContent = discountAmount.toFixed(2);
    document.getElementById('finalPrice').textContent = finalPrice.toFixed(2);
}
