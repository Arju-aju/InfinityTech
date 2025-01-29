// Handle form submission and image management
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('editProductForm');
    
    // Only proceed if we're on the edit product page
    if (!form) return;

    // Store initial form values
    const initialValues = {
        name: form.name.value,
        brand: form.brand.value,
        description: form.description.value,
        category: form.category.value,
        price: form.price.value,
        stock: form.stock.value,
        processor: form.processor?.value || '',
        ram: form.ram?.value || '',
        storage: form.storage?.value || '',
        graphics: form.graphics?.value || ''
    };

    // Function to check if form values have changed
    function hasFormChanged() {
        const currentValues = {
            name: form.name.value.trim(),
            brand: form.brand.value.trim(),
            description: form.description.value.trim(),
            category: form.category.value,
            price: form.price.value,
            stock: form.stock.value,
            processor: form.processor?.value.trim() || '',
            ram: form.ram?.value.trim() || '',
            storage: form.storage?.value.trim() || '',
            graphics: form.graphics?.value.trim() || ''
        };

        // Check if any field has changed
        return Object.keys(initialValues).some(key => initialValues[key] !== currentValues[key]);
    }

    // Function to validate form
    function validateForm() {
        // Required fields validation
        const requiredFields = ['name', 'price', 'stock'];
        const emptyFields = requiredFields.filter(field => !form[field].value.trim());
        
        if (emptyFields.length > 0) {
            throw new Error(`Please fill in all required fields: ${emptyFields.join(', ')}`);
        }

        // Price validation
        if (parseFloat(form.price.value) <= 0) {
            throw new Error('Price must be greater than 0');
        }

        // Stock validation
        if (parseInt(form.stock.value) < 0) {
            throw new Error('Stock cannot be negative');
        }

        // Check if any changes were made
        if (!hasFormChanged() && !form.images.files.length) {
            throw new Error('No changes detected. Please modify at least one field before updating.');
        }

        return true;
    }

    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Validate form
            validateForm();

            // Show loading state
            Swal.fire({
                title: 'Processing...',
                text: 'Please wait while we update the product',
                allowOutsideClick: false,
                showConfirmButton: false,
                willOpen: () => {
                    Swal.showLoading();
                }
            });
            
            const formData = new FormData(form);
            const productId = form.getAttribute('data-product-id');

            if (!productId) {
                throw new Error('Product ID not found');
            }

            // Ensure specifications are properly structured
            const specifications = {
                processor: formData.get('processor'),
                ram: formData.get('ram'),
                storage: formData.get('storage'),
                graphics: formData.get('graphics')
            };
            
            // Remove individual specification fields and add as object
            formData.delete('processor');
            formData.delete('ram');
            formData.delete('storage');
            formData.delete('graphics');
            formData.append('specifications', JSON.stringify(specifications));

            const response = await fetch(`/admin/editProduct/${productId}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to update product');
            }

            // Show success message
            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Product updated successfully',
                timer: 2000,
                showConfirmButton: false
            });

            // Redirect back to products page
            window.location.href = '/admin/products';
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to update product. Please try again.',
                confirmButtonText: 'OK'
            });
        }
    });

    // Preview new images before upload
    function previewNewImages(input) {
        const container = document.getElementById('imagePreviewContainer');
        container.innerHTML = ''; // Clear existing previews

        if (input.files && input.files.length > 0) {
            Array.from(input.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const div = document.createElement('div');
                    div.className = 'relative group';
                    div.innerHTML = `
                        <img src="${e.target.result}" 
                             alt="New image preview" 
                             class="w-full h-32 object-cover rounded-lg">
                        <div class="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <i class="fas fa-times"></i>
                        </div>
                    `;
                    container.appendChild(div);
                };
                reader.readAsDataURL(file);
            });
        }
    }

    // Handle image deletion
    async function deleteImage(productId, imagePath, element) {
        try {
            const result = await Swal.fire({
                title: 'Delete Image?',
                text: 'Are you sure you want to delete this image?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                const response = await fetch(`/admin/deleteProductImage/${productId}/${encodeURIComponent(imagePath)}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('Failed to delete image');
                }

                // Remove the image from the DOM
                element.remove();

                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Image has been deleted.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to delete image. Please try again.',
                confirmButtonText: 'OK'
            });
        }
    }

    // Handle product deletion
    async function confirmDelete(productId) {
        try {
            const result = await Swal.fire({
                title: 'Delete Product?',
                text: "This action cannot be undone!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                const response = await fetch(`/admin/deleteProduct/${productId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('Failed to delete product');
                }

                await Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Product has been deleted.',
                    timer: 2000,
                    showConfirmButton: false
                });

                // Redirect to products page
                window.location.href = '/admin/products';
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to delete product. Please try again.',
                confirmButtonText: 'OK'
            });
        }
    }

    // Make functions available globally
    window.previewNewImages = previewNewImages;
    window.deleteImage = deleteImage;
    window.confirmDelete = confirmDelete;
});
