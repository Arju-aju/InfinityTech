// Category Management Functions
document.addEventListener('DOMContentLoaded', function() {
    // Edit Category Modal
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editCategoryForm = document.getElementById('editCategoryForm');
    const editCategoryNameInput = document.getElementById('editCategoryName');
    const editCategoryDescInput = document.getElementById('editCategoryDescription');
    let currentCategoryId = null;

    // Open Edit Modal
    window.openEditCategoryModal = function(categoryId, name, description) {
        currentCategoryId = categoryId;
        editCategoryNameInput.value = name;
        editCategoryDescInput.value = description;
        editCategoryModal.classList.remove('hidden');
    };

    // Close Edit Modal
    window.closeEditCategoryModal = function() {
        editCategoryModal.classList.add('hidden');
        editCategoryForm.reset();
        currentCategoryId = null;
    };

    // Handle Category Edit Form Submit
    editCategoryForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            const response = await fetch(`/admin/category/${currentCategoryId}/edit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editCategoryNameInput.value,
                    description: editCategoryDescInput.value
                })
            });

            const data = await response.json();
            if (data.success) {
                // Update UI
                const categoryRow = document.querySelector(`tr[data-category-id="${currentCategoryId}"]`);
                if (categoryRow) {
                    categoryRow.querySelector('.category-name').textContent = editCategoryNameInput.value;
                    categoryRow.querySelector('.category-description').textContent = editCategoryDescInput.value;
                }
                closeEditCategoryModal();
                showNotification('Category updated successfully', 'success');
            } else {
                showNotification(data.message || 'Failed to update category', 'error');
            }
        } catch (error) {
            console.error('Error updating category:', error);
            showNotification('Failed to update category', 'error');
        }
    });

    // Toggle Category Status
    window.toggleCategoryStatus = async function(categoryId, button) {
        try {
            const isActive = button.checked;
            const response = await fetch(`/admin/category/${categoryId}/toggle-status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ isActive })
            });

            const data = await response.json();
            if (data.success) {
                const categoryRow = document.querySelector(`tr[data-category-id="${categoryId}"]`);
                if (categoryRow) {
                    categoryRow.classList.toggle('opacity-50', !isActive);
                    const statusBadge = categoryRow.querySelector('.status-badge');
                    if (statusBadge) {
                        statusBadge.textContent = isActive ? 'Active' : 'Inactive';
                        statusBadge.classList.toggle('bg-green-100', isActive);
                        statusBadge.classList.toggle('text-green-800', isActive);
                        statusBadge.classList.toggle('bg-red-100', !isActive);
                        statusBadge.classList.toggle('text-red-800', !isActive);
                    }
                }
                showNotification(`Category ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
            } else {
                button.checked = !isActive; // Revert toggle
                showNotification(data.message || 'Failed to update category status', 'error');
            }
        } catch (error) {
            console.error('Error toggling category status:', error);
            button.checked = !button.checked; // Revert toggle
            showNotification('Failed to update category status', 'error');
        }
    };

    // Notification Helper
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
