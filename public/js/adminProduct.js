async function toggleFeatured(productId) {
    try {
        const response = await fetch(`/admin/products/${productId}/toggle-featured`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            // Refresh the page to show updated status
            window.location.reload();
        } else {
            alert('Failed to toggle featured status');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while toggling featured status');
    }
}

async function softDeleteProduct(productId) {
    if (!confirm('Are you sure you want to deactivate this product?')) {
        return;
    }

    try {
        const response = await fetch(`/admin/products/${productId}/soft-delete`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            // Refresh the page to show updated status
            window.location.reload();
        } else {
            alert('Failed to deactivate product');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while deactivating the product');
    }
}
